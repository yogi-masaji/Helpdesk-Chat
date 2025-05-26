import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ITEMS_PER_PAGE = 15; // Jumlah tiket yang dimuat setiap kali scroll

// Utility function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'Tanggal tidak valid';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    try {
        return new Date(dateString).toLocaleDateString('id-ID', options);
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Tanggal tidak valid';
    }
};

// Komponen untuk menampilkan satu item tiket
const TicketItem = ({ ticket, onSelectTicket, isSelected }) => {
    // ticket.id di sini adalah formatted ID seperti 'TICKET-YYYYMMDD-DBID'
    // ticket.db_id adalah ID asli dari database
    const statusClass = ticket.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const selectedClass = isSelected ? 'bg-indigo-200 border-l-4 border-indigo-600' : 'bg-white';

    return (
        <div
            className={`p-3 border border-slate-200 rounded-lg cursor-pointer transition-colors duration-150 shadow-sm hover:bg-indigo-100 ${selectedClass}`}
            onClick={() => onSelectTicket(ticket.db_id)} // Gunakan db_id untuk memilih
        >
            <div className="flex justify-between items-start">
                <h3 className="text-md font-semibold text-indigo-600">{ticket.id}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>{ticket.status}</span>
            </div>
            <p className="text-sm text-slate-700 truncate" title={ticket.subject}>{ticket.subject}</p>
            <p className="text-xs text-slate-500 mt-1">Pelapor: {ticket.user}</p>
            <p className="text-xs text-slate-500">Update: {formatDate(ticket.updatedAt)}</p>
        </div>
    );
};

// Komponen untuk menampilkan daftar tiket
const TicketList = ({ tickets, onSelectTicket, selectedTicketDbId }) => {
    return (
        <div className="space-y-2 pr-1">
            {tickets.map(ticket => (
                <TicketItem
                    key={ticket.db_id} // Gunakan db_id sebagai key
                    ticket={ticket}
                    onSelectTicket={onSelectTicket}
                    isSelected={ticket.db_id === selectedTicketDbId}
                />
            ))}
        </div>
    );
};

// Komponen untuk menampilkan bubble chat
const ChatBubble = ({ message }) => {
    const isUser = message.type === 'user';
    const bubbleClass = isUser
        ? 'bg-blue-200 text-blue-800 self-start rounded-br-none'
        : 'bg-cyan-100 text-cyan-700 self-end rounded-bl-none';

    return (
        <div className={`max-w-[70%] p-2.5 rounded-2xl mb-2 break-words ${bubbleClass}`}>
            <p className="font-medium text-sm">{message.sender}</p>
            <p className="text-sm">{message.text}</p>
            <p className="text-xs text-right mt-1 opacity-75">{formatDate(message.timestamp)}</p>
        </div>
    );
};

// Komponen utama Aplikasi
function App() {
    const [allTickets, setAllTickets] = useState([]); // Master data tiket dari API
    const [displayedTickets, setDisplayedTickets] = useState([]); // Tiket yang ditampilkan
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false); // Loading untuk daftar tiket
    const [isLoadingMoreTickets, setIsLoadingMoreTickets] = useState(false); // Loading untuk infinite scroll

    const [selectedTicketDbId, setSelectedTicketDbId] = useState(null); // Menyimpan ID database tiket yang dipilih
    const [selectedTicketDetail, setSelectedTicketDetail] = useState(null); // Detail tiket yang dipilih dari API
    const [isLoadingDetail, setIsLoadingDetail] = useState(false); // Loading untuk detail tiket

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState(null);

    const chatMessagesAreaRef = useRef(null);
    const ticketListContainerRef = useRef(null);

    // Fungsi untuk mengambil semua tiket dari API
    const fetchAllTickets = async () => {
        setIsLoadingTickets(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/tickets`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                const transformedTickets = result.data.map(ticket => {
                    const createdAtDate = new Date(ticket.created_at);
                    return {
                        db_id: ticket.id, // ID asli dari database
                        id: `TICKET-${createdAtDate.getFullYear()}${String(createdAtDate.getMonth() + 1).padStart(2, '0')}${String(createdAtDate.getDate()).padStart(2, '0')}-${String(ticket.id).padStart(3, '0')}`,
                        subject: ticket.message?.split('\n')[0] || 'Tanpa Subjek', // Asumsi 'message' adalah subjek awal
                        user: ticket.name,
                        email: ticket.sender, // Asumsi 'sender' adalah email/kontak
                        status: ticket.status === 'open' ? 'Open' : 'Close',
                        createdAt: ticket.created_at,
                        updatedAt: ticket.updated_at,
                        // messages, agent, priority akan di-fetch terpisah saat tiket dipilih
                    };
                }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                setAllTickets(transformedTickets);
            } else {
                throw new Error('Format data tiket tidak sesuai');
            }
        } catch (err) {
            console.error('Gagal mengambil tiket:', err);
            setError('Gagal memuat daftar tiket. Silakan coba lagi nanti.');
            setAllTickets([]); // Kosongkan tiket jika error
        } finally {
            setIsLoadingTickets(false);
        }
    };

    useEffect(() => {
        fetchAllTickets();
    }, []);

    // Memoized filtered list from allTickets
    const allFilteredTickets = useMemo(() => {
        return allTickets.filter(ticket => {
            const matchesId = ticket.id.toLowerCase().includes(searchTerm.toLowerCase()); // Cari berdasarkan formatted ID
            const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
            return matchesId && matchesStatus;
        });
    }, [allTickets, searchTerm, statusFilter]);

    // Function to load displayed tickets (pagination/infinite scroll)
    const loadDisplayedTickets = useCallback((page, filteredList) => {
        const newTickets = filteredList.slice(0, page * ITEMS_PER_PAGE);
        setDisplayedTickets(newTickets);
        setHasMore(newTickets.length < filteredList.length);
    }, []);

    // Initial load for displayed tickets and when filters change
    useEffect(() => {
        setCurrentPage(1); // Reset page
        loadDisplayedTickets(1, allFilteredTickets);
    }, [allFilteredTickets, loadDisplayedTickets]);


    // Infinite scroll handler
    const handleScroll = useCallback(() => {
        if (ticketListContainerRef.current && hasMore && !isLoadingMoreTickets && !isLoadingTickets) {
            const { scrollTop, scrollHeight, clientHeight } = ticketListContainerRef.current;
            if (scrollHeight - scrollTop - clientHeight < 200) { // Trigger lebih awal
                setIsLoadingMoreTickets(true);
                const nextPage = currentPage + 1;
                // Simulate network delay for loading more, actual data is already client-side
                setTimeout(() => {
                    loadDisplayedTickets(nextPage, allFilteredTickets);
                    setCurrentPage(nextPage);
                    setIsLoadingMoreTickets(false);
                }, 300);
            }
        }
    }, [currentPage, hasMore, isLoadingMoreTickets, isLoadingTickets, allFilteredTickets, loadDisplayedTickets]);

    useEffect(() => {
        const container = ticketListContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // Fetch ticket detail when selectedTicketDbId changes
    useEffect(() => {
        if (selectedTicketDbId) {
            const fetchTicketDetail = async () => {
                setIsLoadingDetail(true);
                setError(null);
                try {
                    const response = await fetch(`${API_BASE_URL}/ticket/${selectedTicketDbId}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    // Backend /ticket/:id sudah mengembalikan format yang cukup sesuai
                    setSelectedTicketDetail(data);
                } catch (err) {
                    console.error(`Gagal mengambil detail tiket ${selectedTicketDbId}:`, err);
                    setError(`Gagal memuat detail tiket. ID: ${selectedTicketDbId}`);
                    setSelectedTicketDetail(null);
                } finally {
                    setIsLoadingDetail(false);
                }
            };
            fetchTicketDetail();
        } else {
            setSelectedTicketDetail(null); // Clear detail jika tidak ada tiket dipilih
        }
    }, [selectedTicketDbId]);


    // Efek untuk scroll ke bawah saat pesan baru ditambahkan atau tiket dipilih
    useEffect(() => {
        if (chatMessagesAreaRef.current) {
            chatMessagesAreaRef.current.scrollTop = chatMessagesAreaRef.current.scrollHeight;
        }
    }, [selectedTicketDetail?.messages]); // Bergantung pada messages dari selectedTicketDetail

    const handleSelectTicket = (db_id) => {
        setSelectedTicketDbId(db_id);
    };

    const handleToggleTicketStatus = () => {
        // CATATAN: Backend tidak memiliki endpoint untuk update status.
        // Perubahan ini hanya bersifat visual di frontend dan tidak persisten.
        if (!selectedTicketDetail) return;
        
        const newStatus = selectedTicketDetail.status === 'Open' ? 'Close' : 'Open';
        const newUpdatedAt = new Date().toISOString();

        // Optimistic update di detail
        setSelectedTicketDetail(prev => prev ? { ...prev, status: newStatus, updatedAt: newUpdatedAt } : null);

        // Optimistic update di daftar allTickets (dan secara tidak langsung di displayedTickets)
        setAllTickets(prevAllTickets =>
            prevAllTickets.map(ticket =>
                ticket.db_id === selectedTicketDbId
                    ? { ...ticket, status: newStatus, updatedAt: newUpdatedAt }
                    : ticket
            )
        );
        console.warn("Status tiket diubah di frontend saja. Implementasikan endpoint backend untuk menyimpan perubahan status.");
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedTicketDbId) return;

        const tempMessageId = `temp-${Date.now()}`;
        const agentMessageForUI = {
            id: tempMessageId,
            sender: 'Agen Helpdesk', // Atau nama agen yang login
            text: newMessage.trim(),
            timestamp: new Date().toISOString(),
            type: 'agent',
        };

        // Optimistic UI update
        setSelectedTicketDetail(prev => prev ? { ...prev, messages: [...prev.messages, agentMessageForUI] } : null);
        const originalMessageInput = newMessage;
        setNewMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticket_id: selectedTicketDbId, // Kirim ID database
                    message: originalMessageInput.trim(),
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'Gagal mengirim pesan, respons tidak valid.' }));
                throw new Error(errData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                // Pesan berhasil dikirim ke backend & WhatsApp
                // Idealnya, backend via Socket.IO akan mengirim pesan baru, atau kita fetch ulang.
                // Untuk sekarang, kita fetch ulang detail tiket untuk mendapatkan pesan yang sudah tersimpan di DB.
                const detailResponse = await fetch(`${API_BASE_URL}/ticket/${selectedTicketDbId}`);
                const updatedDetail = await detailResponse.json();
                setSelectedTicketDetail(updatedDetail);

                // Update updatedAt di allTickets juga
                setAllTickets(prevAll => prevAll.map(t => 
                    t.db_id === selectedTicketDbId ? {...t, updatedAt: new Date().toISOString()} : t
                ));

            } else {
                throw new Error(result.message || 'Gagal mengirim pesan dari backend.');
            }
        } catch (err) {
            console.error('Gagal mengirim pesan:', err);
            setError(`Gagal mengirim pesan: ${err.message}`);
            // Rollback optimistic update jika gagal
            setSelectedTicketDetail(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempMessageId) } : null);
            setNewMessage(originalMessageInput); // Kembalikan teks ke input
        }
    };
    
    const styles = `
        body { font-family: 'Inter', sans-serif; background-color: #f0f4f8; }
        #chat-messages-area::-webkit-scrollbar { width: 8px; }
        #chat-messages-area::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        #chat-messages-area::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        #chat-messages-area::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        #chat-messages-area { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f1f1; }

        #ticket-items-container::-webkit-scrollbar { width: 6px; }
        #ticket-items-container::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        #ticket-items-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        #ticket-items-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        #ticket-items-container { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f1f1; }
        .loading-indicator { text-align: center; padding: 10px; color: #4f46e5; }
        .error-message { text-align: center; padding: 10px; color: #ef4444; background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 0.5rem; margin: 10px; }
    `;


    return (
        <>
            <style>{styles}</style>
            <div className="flex flex-col h-screen text-gray-800">
                <header className="bg-indigo-600 text-white p-4 shadow-md">
                    <h1 className="text-2xl font-semibold">Helpdesk</h1>
                </header>

                {error && <div className="error-message">{error} <button onClick={() => setError(null)} className="ml-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Tutup</button></div>}

                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-1/3 bg-slate-100 border-r border-slate-300 p-4 flex flex-col">
                        <h2 className="text-xl font-semibold mb-4 text-slate-700">Daftar Tiket</h2>
                        <div className="search-filter-area mb-4 space-y-3">
                            <input
                                type="text"
                                placeholder="Cari Kode Tiket (misal: TICKET-20240527-001)"
                                className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <select
                                className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Semua Status</option>
                                <option value="Open">Open</option>
                                <option value="Close">Close</option>
                            </select>
                        </div>
                        <div id="ticket-items-container" ref={ticketListContainerRef} className="flex-1 overflow-y-auto min-h-0">
                            {isLoadingTickets ? (
                                <div className="loading-indicator">Memuat daftar tiket...</div>
                            ) : (
                                <>
                                    <TicketList
                                        tickets={displayedTickets}
                                        onSelectTicket={handleSelectTicket}
                                        selectedTicketDbId={selectedTicketDbId}
                                    />
                                    {isLoadingMoreTickets && <div className="loading-indicator">Memuat tiket lainnya...</div>}
                                    {!isLoadingMoreTickets && !hasMore && displayedTickets.length > 0 && <div className="text-center p-3 text-slate-500 text-sm">Semua tiket telah dimuat.</div>}
                                    {!isLoadingMoreTickets && allFilteredTickets.length === 0 && !isLoadingTickets && <div className="flex justify-center items-center h-full text-slate-500">Tidak ada tiket yang cocok.</div>}
                                </>
                            )}
                        </div>
                    </aside>

                    <main className="w-2/3 bg-white p-0 flex flex-col">
                        {isLoadingDetail ? (
                             <div className="flex justify-center items-center h-full text-slate-500 text-lg">Memuat detail tiket...</div>
                        ) : !selectedTicketDetail ? (
                            <div className="flex justify-center items-center h-full text-slate-500 text-lg">
                                Pilih tiket untuk melihat percakapan.
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-4 border-b border-slate-200 bg-slate-50">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            {/* selectedTicketDetail.id adalah formatted ID dari backend */}
                                            <h3 className="text-lg font-semibold text-indigo-700">{selectedTicketDetail.id}</h3>
                                            <p className="text-md text-slate-600">{selectedTicketDetail.subject}</p>
                                        </div>
                                        <button
                                            onClick={handleToggleTicketStatus}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 text-white ${
                                                selectedTicketDetail.status === 'Open' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                                            }`}
                                        >
                                            {selectedTicketDetail.status === 'Open' ? 'Tutup Tiket' : 'Buka Kembali Tiket'}
                                        </button>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-500 space-y-0.5">
                                        <p>Pelapor: <span className="font-medium">{selectedTicketDetail.user}</span> (<span className="font-medium">{selectedTicketDetail.email}</span>)</p>
                                        <p>Status Saat Ini: <span className="font-medium">{selectedTicketDetail.status}</span></p>
                                        <p>Agen: <span className="font-medium">{selectedTicketDetail.agent || '-'}</span></p>
                                        <p>Dibuat: <span className="font-medium">{formatDate(selectedTicketDetail.createdAt)}</span></p>
                                        <p>Update Terakhir: <span className="font-medium">{formatDate(selectedTicketDetail.updatedAt)}</span></p>
                                    </div>
                                </div>

                                <div 
                                    id="chat-messages-area" 
                                    ref={chatMessagesAreaRef} 
                                    className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 flex flex-col min-h-0"
                                >
                                    {selectedTicketDetail.messages.map(msg => (
                                        <ChatBubble key={msg.id} message={msg} />
                                    ))}
                                    {selectedTicketDetail.messages.length === 0 && (
                                        <p className="text-center text-slate-500">Belum ada pesan dalam tiket ini.</p>
                                    )}
                                </div>

                                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
                                    <div className="flex items-center space-x-2">
                                        <textarea
                                            placeholder="Ketik balasan Anda di sini..."
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                            rows="2"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage(e);
                                                }
                                            }}
                                            disabled={isLoadingDetail} // Disable saat detail sedang loading
                                        />
                                        <button
                                            type="submit"
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-150 disabled:opacity-50"
                                            disabled={isLoadingDetail || !newMessage.trim()}
                                        >
                                            Kirim
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}

export default App;
