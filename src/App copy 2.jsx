import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// Impor ikon jika Anda menggunakan library ikon seperti react-icons
// import { FiLock, FiUnlock, FiSend, FiChevronDown } from 'react-icons/fi'; // Contoh ikon

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ITEMS_PER_PAGE = 15;

// BARU: Hardcoded list of agents
const AVAILABLE_AGENTS = ['Yogi Masaji', 'Budi Santoso', 'Citra Lestari', 'Dewi Anggraini'];

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

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, isLoading, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4 text-slate-800">{title}</h3>
                <p className="text-slate-600 mb-6">{children || message}</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors duration-150 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-lg text-white transition-colors duration-150 disabled:opacity-50 ${
                            confirmText.toLowerCase().includes('tutup') || confirmText.toLowerCase().includes('hapus')
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {isLoading ? 'Memproses...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


const TicketItem = ({ ticket, onSelectTicket, isSelected }) => {
    const statusClass = ticket.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const selectedClass = isSelected ? 'bg-indigo-200 border-l-4 border-indigo-600' : 'bg-white';

    return (
        <div
            className={`p-3 border border-slate-200 rounded-lg cursor-pointer transition-colors duration-150 shadow-sm hover:bg-indigo-100 ${selectedClass}`}
            onClick={() => onSelectTicket(ticket.db_id)}
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

const TicketList = ({ tickets, onSelectTicket, selectedTicketDbId }) => {
    return (
        <div className="space-y-2 pr-1">
            {tickets.map(ticket => (
                <TicketItem
                    key={ticket.db_id}
                    ticket={ticket}
                    onSelectTicket={onSelectTicket}
                    isSelected={ticket.db_id === selectedTicketDbId}
                />
            ))}
        </div>
    );
};

const ChatBubble = ({ message }) => {
    const isAgentMessage = AVAILABLE_AGENTS.includes(message.sender) || message.type === 'agent';
    const bubbleClass = !isAgentMessage
        ? 'bg-sky-100 text-sky-800 self-start rounded-tr-2xl rounded-l-2xl rounded-bl-none'
        : 'bg-slate-200 text-slate-700 self-end rounded-tl-2xl rounded-r-2xl rounded-br-none';

    const timestampStyle = "text-xs opacity-60 mt-1";
    const timestampAlign = isAgentMessage ? "text-right" : "text-left";


    return (
        <div className={`max-w-[75%] w-fit p-2.5 mb-1.5 flex flex-col ${isAgentMessage ? 'self-end items-end' : 'self-start items-start'}`}>
            <div className={`px-3 py-2 rounded-xl shadow-sm ${bubbleClass}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
            </div>
            <p className={`${timestampStyle} ${timestampAlign}`}>{formatDate(message.timestamp).split(',')[1] || formatDate(message.timestamp)}</p>
        </div>
    );
};

function App() {
    const [allTickets, setAllTickets] = useState([]);
    const [displayedTickets, setDisplayedTickets] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);
    const [isLoadingMoreTickets, setIsLoadingMoreTickets] = useState(false);

    const [selectedTicketDbId, setSelectedTicketDbId] = useState(null);
    const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState(null);

    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusToChange, setStatusToChange] = useState({ dbId: null, newStatusBackend: '', newStatusDisplay: '' });
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const [selectedAgentForChat, setSelectedAgentForChat] = useState(AVAILABLE_AGENTS[0] || '');
    const [isChatJoined, setIsChatJoined] = useState(false);


    const chatMessagesAreaRef = useRef(null);
    const ticketListContainerRef = useRef(null);

    const fetchAllTickets = async () => {
        setIsLoadingTickets(true);
        setError(null);
        try {
            if (!API_BASE_URL) {
                console.warn("API_BASE_URL not set. Using mock data.");
                const mockData = Array.from({ length: 30 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const status = i % 3 === 0 ? 'closed' : 'open';
                    return {
                        id: i + 1,
                        created_at: date.toISOString(),
                        updated_at: date.toISOString(),
                        message: `Ini adalah subjek tiket ${i + 1}\nDengan beberapa detail tambahan.`,
                        name: `Pengguna ${i + 1}`,
                        sender: `user${i+1}@example.com`,
                        status: status,
                    };
                });
                 const transformedTickets = mockData.map(ticket => {
                    const createdAtDate = new Date(ticket.created_at);
                    return {
                        db_id: ticket.id,
                        id: `TICKET-${createdAtDate.getFullYear()}${String(createdAtDate.getMonth() + 1).padStart(2, '0')}${String(createdAtDate.getDate()).padStart(2, '0')}-${String(ticket.id).padStart(3, '0')}`,
                        subject: ticket.message?.split('\n')[0] || 'Tanpa Subjek',
                        user: ticket.name,
                        email: ticket.sender,
                        status: ticket.status === 'open' ? 'Open' : 'Close',
                        createdAt: ticket.created_at,
                        updatedAt: ticket.updated_at,
                    };
                }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                setAllTickets(transformedTickets);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/tickets`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                const transformedTickets = result.data.map(ticket => {
                    const createdAtDate = new Date(ticket.created_at);
                    return {
                        db_id: ticket.id,
                        id: `TICKET-${createdAtDate.getFullYear()}${String(createdAtDate.getMonth() + 1).padStart(2, '0')}${String(createdAtDate.getDate()).padStart(2, '0')}-${String(ticket.id).padStart(3, '0')}`,
                        subject: ticket.message?.split('\n')[0] || 'Tanpa Subjek',
                        user: ticket.name,
                        email: ticket.sender,
                        status: ticket.status === 'open' ? 'Open' : 'Close',
                        createdAt: ticket.created_at,
                        updatedAt: ticket.updated_at,
                    };
                }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                setAllTickets(transformedTickets);
            } else {
                throw new Error('Format data tiket tidak sesuai');
            }
        } catch (err) {
            console.error('Gagal mengambil tiket:', err);
            setError('Gagal memuat daftar tiket. Silakan coba lagi nanti.');
            setAllTickets([]);
        } finally {
            setIsLoadingTickets(false);
        }
    };

    useEffect(() => {
        fetchAllTickets();
    }, []);

    const allFilteredTickets = useMemo(() => {
        return allTickets.filter(ticket => {
            const matchesId = ticket.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
            return matchesId && matchesStatus;
        });
    }, [allTickets, searchTerm, statusFilter]);

    const loadDisplayedTickets = useCallback((page, filteredList) => {
        const newTickets = filteredList.slice(0, page * ITEMS_PER_PAGE);
        setDisplayedTickets(newTickets);
        setHasMore(newTickets.length < filteredList.length);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
        loadDisplayedTickets(1, allFilteredTickets);
    }, [allFilteredTickets, loadDisplayedTickets]);

    const handleScroll = useCallback(() => {
        if (ticketListContainerRef.current && hasMore && !isLoadingMoreTickets && !isLoadingTickets) {
            const { scrollTop, scrollHeight, clientHeight } = ticketListContainerRef.current;
            if (scrollHeight - scrollTop - clientHeight < 200) { 
                setIsLoadingMoreTickets(true);
                const nextPage = currentPage + 1;
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

    useEffect(() => {
        if (selectedTicketDbId) {
            const fetchTicketDetail = async () => {
                setIsLoadingDetail(true);
                setError(null);
                try {
                    if (!API_BASE_URL) {
                        const ticketData = allTickets.find(t => t.db_id === selectedTicketDbId);
                        if (ticketData) {
                             const mockDetail = {
                                ...ticketData,
                                agent: null, 
                                messages: [
                                    {id: `msg1-${ticketData.db_id}`, sender: ticketData.user, text: `Ini pertanyaan untuk tiket ${ticketData.id}.`, timestamp: new Date().toISOString(), type: 'user'},
                                    {id: `msg2-${ticketData.db_id}`, sender: "Customer Support (System Message)", text: "Hi! How can we help?", timestamp: new Date().toISOString(), type: 'agent'}
                                ]
                            };
                            setSelectedTicketDetail(mockDetail);
                        } else {
                             throw new Error(`Mock ticket detail not found for ID: ${selectedTicketDbId}`);
                        }
                        return;
                    }

                    const response = await fetch(`${API_BASE_URL}/ticket/${selectedTicketDbId}`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    const transformedDetail = {
                        ...data,
                        status: data.status === 'open' ? 'Open' : (data.status === 'closed' ? 'Close' : data.status)
                    };
                    setSelectedTicketDetail(transformedDetail);

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
            setSelectedTicketDetail(null);
            setIsChatJoined(false);
        }
    }, [selectedTicketDbId, allTickets]);

    useEffect(() => {
        if (chatMessagesAreaRef.current && isChatJoined) {
            chatMessagesAreaRef.current.scrollTop = chatMessagesAreaRef.current.scrollHeight;
        }
    }, [selectedTicketDetail?.messages, isChatJoined]);

    const handleSelectTicket = (db_id) => {
        setSelectedTicketDbId(db_id);
        setIsChatJoined(false);
    };

    const handleOpenStatusModal = () => {
        if (!selectedTicketDetail) return;
        const currentStatusDisplay = selectedTicketDetail.status;
        const newStatusBackend = currentStatusDisplay === 'Open' ? 'closed' : 'open';
        const newStatusDisplay = newStatusBackend === 'open' ? 'Open' : 'Close';

        setStatusToChange({
            dbId: selectedTicketDbId,
            newStatusBackend,
            newStatusDisplay,
        });
        setIsStatusModalOpen(true);
    };

    const handleConfirmUpdateStatus = async () => {
        if (!statusToChange.dbId) return;
        setIsUpdatingStatus(true);
        setError(null);

        const originalTicketDetail = { ...selectedTicketDetail };
        const originalAllTickets = [...allTickets];
        const newUpdatedAt = new Date().toISOString();

        setSelectedTicketDetail(prev => prev ? { ...prev, status: statusToChange.newStatusDisplay, updatedAt: newUpdatedAt } : null);
        setAllTickets(prevAllTickets =>
            prevAllTickets.map(ticket =>
                ticket.db_id === statusToChange.dbId
                    ? { ...ticket, status: statusToChange.newStatusDisplay, updatedAt: newUpdatedAt }
                    : ticket
            )
        );
        
        if (!API_BASE_URL) { 
            console.log(`Mock update status for ticket ${statusToChange.dbId} to ${statusToChange.newStatusBackend}`);
            setTimeout(() => {
                setIsUpdatingStatus(false);
                setIsStatusModalOpen(false);
                setStatusToChange({ dbId: null, newStatusBackend: '', newStatusDisplay: ''});
            }, 500);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/ticket/status/${statusToChange.dbId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: statusToChange.newStatusBackend }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Gagal memperbarui status tiket (status: ${response.status})`);
            }
            setError(null);
            console.log('Status tiket berhasil diperbarui:', result.message);
        } catch (err) {
            console.error('Gagal memperbarui status tiket:', err);
            setError(`Gagal memperbarui status: ${err.message}. Perubahan dibatalkan.`);
            setSelectedTicketDetail(originalTicketDetail);
            setAllTickets(originalAllTickets);
        } finally {
            setIsUpdatingStatus(false);
            setIsStatusModalOpen(false);
            setStatusToChange({ dbId: null, newStatusBackend: '', newStatusDisplay: ''});
        }
    };

    const handleJoinChat = () => {
        if (!selectedAgentForChat) {
            setError("Silakan pilih agen terlebih dahulu.");
            return;
        }
        setIsChatJoined(true);
        setError(null);
        if(selectedTicketDetail){
            setSelectedTicketDetail(prev => prev ? {...prev, agent: selectedAgentForChat } : null);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedTicketDbId || !isChatJoined) return;

        const tempMessageId = `temp-${Date.now()}`;
        const agentMessageForUI = {
            id: tempMessageId,
            sender: selectedAgentForChat,
            text: newMessage.trim(),
            timestamp: new Date().toISOString(),
            type: 'agent',
        };

        setSelectedTicketDetail(prev => prev ? { ...prev, messages: [...(prev.messages || []), agentMessageForUI] } : null);
        const originalMessageInput = newMessage;
        setNewMessage('');

        if (!API_BASE_URL) { 
            console.log(`Mock send message for ticket ${selectedTicketDbId}: ${originalMessageInput.trim()} by ${selectedAgentForChat}`);
            setAllTickets(prevAll => prevAll.map(t =>
                t.db_id === selectedTicketDbId ? { ...t, updatedAt: new Date().toISOString() } : t
            ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: selectedTicketDbId,
                    message: originalMessageInput.trim(),
                    agent_name: selectedAgentForChat 
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'Gagal mengirim pesan, respons tidak valid.' }));
                throw new Error(errData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                const detailResponse = await fetch(`${API_BASE_URL}/ticket/${selectedTicketDbId}`);
                const updatedDetailData = await detailResponse.json();
                const transformedDetail = {
                    ...updatedDetailData,
                    status: updatedDetailData.status === 'open' ? 'Open' : (updatedDetailData.status === 'closed' ? 'Close' : updatedDetailData.status),
                    agent: selectedAgentForChat 
                };
                setSelectedTicketDetail(transformedDetail);

                setAllTickets(prevAll => prevAll.map(t =>
                    t.db_id === selectedTicketDbId ? { ...t, updatedAt: new Date().toISOString() } : t
                ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));

            } else {
                throw new Error(result.message || 'Gagal mengirim pesan dari backend.');
            }
        } catch (err) {
            console.error('Gagal mengirim pesan:', err);
            setError(`Gagal mengirim pesan: ${err.message}`);
            setSelectedTicketDetail(prev => {
                if (!prev) return null;
                return { ...prev, messages: (prev.messages || []).filter(m => m.id !== tempMessageId) };
            });
            setNewMessage(originalMessageInput);
        }
    };
    
    const styles = `
        body { font-family: 'Inter', sans-serif; background-color: #f0f4f8; } /* MODIFIKASI: Mengembalikan style body */
        #chat-messages-area::-webkit-scrollbar, #ticket-items-container::-webkit-scrollbar { width: 6px; }
        #chat-messages-area::-webkit-scrollbar-track, #ticket-items-container::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        #chat-messages-area::-webkit-scrollbar-thumb, #ticket-items-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        #chat-messages-area::-webkit-scrollbar-thumb:hover, #ticket-items-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        #chat-messages-area, #ticket-items-container { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f1f1; }
        
        .loading-indicator { text-align: center; padding: 10px; color: #4f46e5; }
        .error-message { text-align: center; padding: 10px; color: #ef4444; background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 0.5rem; margin: 10px; }

        .agent-select-wrapper {
            position: relative;
            display: inline-block;
        }
        .agent-select-wrapper select {
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-color: white;
            border: 1px solid #d1d5db; 
            border-radius: 0.375rem; 
            padding: 0.5rem 2.5rem 0.5rem 0.75rem; 
            font-size: 0.875rem; 
            line-height: 1.25rem;
            color: #374151; 
            cursor: pointer;
            min-width: 180px; 
        }
        .agent-select-wrapper select:focus {
            outline: 2px solid transparent;
            outline-offset: 2px;
            border-color: #4f46e5; 
        }
        .agent-select-arrow {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            padding-right: 0.5rem; 
            pointer-events: none; 
            color: #6b7280; 
        }
    `;

    return (
        <>
            <style>{styles}</style>
            {/* MODIFIKASI: Mengembalikan kontainer utama ke mode fullscreen */}
            <div className="flex flex-col h-screen text-gray-800"> {/* MODIFIKASI: Kembali ke h-screen */}
                <header className="bg-indigo-600 text-white p-4 shadow-md flex-shrink-0"> {/* MODIFIKASI: Padding header kembali ke p-4 */}
                    <h1 className="text-2xl font-semibold">Helpdesk</h1> {/* MODIFIKASI: Font size header kembali ke 2xl */}
                </header>

                {error && <div className="error-message mx-4 my-2">{error} <button onClick={() => setError(null)} className="ml-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Tutup</button></div>}

                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-1/3 bg-slate-100 border-r border-slate-300 p-4 flex flex-col"> {/* MODIFIKASI: Kembali ke p-4 dan hapus max-w-xs */}
                        <h2 className="text-xl font-semibold mb-4 text-slate-700">Daftar Tiket</h2> {/* MODIFIKASI: Kembali ke text-xl dan mb-4 */}
                        <div className="search-filter-area mb-4 space-y-3">
                            <input
                                type="text"
                                placeholder="Cari Kode Tiket" // Placeholder disesuaikan
                                className="w-full p-2 text-base border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" // MODIFIKASI: text-base, rounded-lg
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <select
                                className="w-full p-2 text-base border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" // MODIFIKASI: text-base, rounded-lg
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Semua Status</option>
                                <option value="Open">Open</option>
                                <option value="Close">Close</option>
                            </select>
                        </div>
                        <div id="ticket-items-container" ref={ticketListContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
                            {isLoadingTickets ? (
                                <div className="loading-indicator">Memuat daftar tiket...</div> // Teks disesuaikan
                            ) : (
                                <>
                                    <TicketList
                                        tickets={displayedTickets}
                                        onSelectTicket={handleSelectTicket}
                                        selectedTicketDbId={selectedTicketDbId}
                                    />
                                    {isLoadingMoreTickets && <div className="loading-indicator">Memuat tiket lainnya...</div>}
                                    {!isLoadingMoreTickets && !hasMore && displayedTickets.length > 0 && <div className="text-center p-3 text-slate-500 text-sm">Semua tiket telah dimuat.</div>} {/* MODIFIKASI: text-sm, p-3 */}
                                    {!isLoadingMoreTickets && allFilteredTickets.length === 0 && !isLoadingTickets && <div className="flex justify-center items-center h-full text-slate-500 text-base">Tidak ada tiket yang cocok.</div>} {/* MODIFIKASI: text-base */}
                                </>
                            )}
                        </div>
                    </aside>

                    <main className="w-2/3 bg-white flex flex-col overflow-hidden"> {/* MODIFIKASI: Kembali ke w-2/3 */}
                        {isLoadingDetail ? (
                            <div className="flex justify-center items-center h-full text-slate-500 text-lg">Memuat detail tiket...</div>
                        ) : !selectedTicketDetail ? (
                            <div className="flex justify-center items-center h-full text-slate-500 text-lg p-4 text-center"> {/* MODIFIKASI: text-lg */}
                                Pilih tiket untuk melihat percakapan.
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0"> {/* MODIFIKASI: Kembali ke p-4 */}
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-semibold text-indigo-700">{selectedTicketDetail.id}</h3> {/* MODIFIKASI: text-lg */}
                                            <p className="text-md text-slate-600 truncate max-w-full" title={selectedTicketDetail.subject}>{selectedTicketDetail.subject}</p> {/* MODIFIKASI: text-md, max-w-full */}
                                        </div>
                                        <button
                                            onClick={handleOpenStatusModal}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 text-white flex items-center space-x-2 ${ // MODIFIKASI: px-4, py-2, text-sm, space-x-2
                                                selectedTicketDetail.status === 'Open' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                                            }`}
                                            disabled={isUpdatingStatus}
                                        >
                                            <span>{selectedTicketDetail.status === 'Open' ? 'Tutup Tiket' : 'Buka Kembali Tiket'}</span>
                                        </button>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-500 space-y-0.5"> {/* MODIFIKASI: text-sm, mt-2 */}
                                        <p>Pelapor: <span className="font-medium text-slate-700">{selectedTicketDetail.user}</span> (<span className="font-medium text-slate-700">{selectedTicketDetail.email}</span>)</p>
                                        <p>Status: <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${selectedTicketDetail.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{selectedTicketDetail.status}</span></p>
                                        <p>Agen: <span className="font-medium text-slate-700">{isChatJoined ? selectedAgentForChat : (selectedTicketDetail.agent || '-')}</span></p>
                                    </div>
                                </div>

                                <div 
                                    id="chat-messages-area" 
                                    ref={chatMessagesAreaRef} 
                                    className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 flex flex-col min-h-0" // MODIFIKASI: p-4, bg-slate-50
                                >
                                    {selectedTicketDetail.messages && selectedTicketDetail.messages.length > 0 ? selectedTicketDetail.messages.map(msg => (
                                        <ChatBubble key={msg.id} message={msg} />
                                    )) : (
                                        <p className="text-center text-slate-500 text-base mt-4">Belum ada pesan dalam tiket ini.</p> // MODIFIKASI: text-base, text-slate-500
                                    )}
                                </div>
                                <div className="p-3 border-t border-slate-200 bg-slate-100 flex-shrink-0">
                                    {!isChatJoined ? (
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="agent-select-wrapper">
                                                <select
                                                    value={selectedAgentForChat}
                                                    onChange={(e) => setSelectedAgentForChat(e.target.value)}
                                                    disabled={AVAILABLE_AGENTS.length === 0}
                                                >
                                                    {AVAILABLE_AGENTS.length > 0 ? (
                                                        AVAILABLE_AGENTS.map(agent => (
                                                            <option key={agent} value={agent}>{agent}</option>
                                                        ))
                                                    ) : (
                                                        <option value="" disabled>Tidak ada agen</option>
                                                    )}
                                                </select>
                                                <div className="agent-select-arrow">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleJoinChat}
                                                disabled={!selectedAgentForChat || AVAILABLE_AGENTS.length === 0}
                                                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                Join Chat
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                                            <textarea
                                                placeholder="Ketik balasan Anda..."
                                                className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-sm"
                                                rows="2"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendMessage(e);
                                                    }
                                                }}
                                                disabled={isLoadingDetail || isUpdatingStatus || selectedTicketDetail.status === 'Close' || !isChatJoined}
                                            />
                                            <button
                                                type="submit"
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                                                disabled={isLoadingDetail || isUpdatingStatus || !newMessage.trim() || selectedTicketDetail.status === 'Close' || !isChatJoined}
                                            >
                                                Kirim
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </div>
            
            <ConfirmModal
                isOpen={isStatusModalOpen}
                onClose={() => setIsStatusModalOpen(false)}
                onConfirm={handleConfirmUpdateStatus}
                title={`Konfirmasi ${statusToChange.newStatusBackend === 'closed' ? 'Penutupan' : 'Pembukaan Kembali'} Tiket`}
                confirmText={`${statusToChange.newStatusBackend === 'closed' ? 'Ya, Tutup Tiket' : 'Ya, Buka Tiket'}`}
                isLoading={isUpdatingStatus}
            >
                Apakah Anda yakin ingin {statusToChange.newStatusBackend === 'closed' ? 'menutup' : 'membuka kembali'} tiket ini?
                {statusToChange.newStatusBackend === 'closed' && selectedTicketDetail?.id &&
                    <p className="text-sm text-amber-700 mt-2 bg-amber-100 p-2 rounded">Pelapor akan menerima notifikasi bahwa tiket <span className="font-semibold">{selectedTicketDetail.id}</span> telah ditutup.</p>
                }
            </ConfirmModal>
        </>
    );
}

export default App;
