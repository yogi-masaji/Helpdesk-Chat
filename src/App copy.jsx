import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";



const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

const ITEMS_PER_PAGE = 15;

const DETAIL_POLLING_INTERVAL = 5000; // Polling detail tiket setiap 5 detik

const LIST_POLLING_INTERVAL = 5000; // Polling daftar tiket setiap 5 detik

// Function to play custom notification sound

const playNotificationSound = () => {
  try {
    

    const audio = new Audio("/notification.wav"); 

    audio.play().catch((error) => {
      

      console.warn("Audio play prevented:", error);
    });
  } catch (error) {
    console.error("Error playing custom notification sound:", error);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "Tanggal tidak valid";

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  try {
    return new Date(dateString).toLocaleDateString("id-ID", options);
  } catch (error) {
    console.error("Error formatting date:", dateString, error);

    return "Tanggal tidak valid";
  }
};

// Komponen Modal Konfirmasi

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  isLoading,
  children,
}) => {
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
              confirmText.toLowerCase().includes("tutup") ||
              confirmText.toLowerCase().includes("hapus")
                ? "bg-red-500 hover:bg-red-600"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isLoading ? "Memproses..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const TicketItem = ({ ticket, onSelectTicket, isSelected }) => {
  const statusClass =
    ticket.status === "Open"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";

  const selectedClass = isSelected
    ? "bg-indigo-200 border-l-4 border-indigo-600"
    : "bg-white";

  return (
    <div
      className={`p-3 border border-slate-200 rounded-lg cursor-pointer transition-colors duration-150 shadow-sm hover:bg-indigo-100 ${selectedClass}`}
      onClick={() => onSelectTicket(ticket.db_id)}
    >
      <div className="flex justify-between items-start">
        <h3 className="text-md font-semibold text-indigo-600">{ticket.id}</h3>

        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
        >
          {ticket.status}
        </span>
      </div>

      <p className="text-sm text-slate-700 truncate" title={ticket.subject}>
        {ticket.subject}
      </p>

      <p className="text-xs text-slate-500 mt-1">Pelapor: {ticket.user}</p>

      <p className="text-xs text-slate-500">
        Update: {formatDate(ticket.updatedAt)}
      </p>
    </div>
  );
};

const TicketList = ({ tickets, onSelectTicket, selectedTicketDbId }) => {
  return (
    <div className="space-y-2 pr-1">
      {tickets.map((ticket) => (
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

const ChatBubble = React.memo(({ message }) => {
  const isUser = message.type === "user";

  const bubbleClass = isUser
    ? "bg-blue-200 text-blue-800 self-start rounded-br-none"
    : "bg-cyan-100 text-cyan-700 self-end rounded-bl-none";

  return (
    <div
      className={`max-w-[70%] p-2.5 rounded-2xl mb-2 break-words ${bubbleClass}`}
    >
      <p className="font-medium text-sm">{message.sender}</p>

      <p className="text-sm whitespace-pre-wrap">{message.text}</p>

      <p className="text-xs text-right mt-1 opacity-75">
        {formatDate(message.timestamp)}
      </p>
    </div>
  );
});

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

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [newMessage, setNewMessage] = useState("");

  const [error, setError] = useState(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const [statusToChange, setStatusToChange] = useState({
    dbId: null,
    newStatusBackend: "",
    newStatusDisplay: "",
  });

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const detailPollingIntervalRef = useRef(null);

  const listPollingIntervalRef = useRef(null);

  const chatMessagesAreaRef = useRef(null);

  const ticketListContainerRef = useRef(null);

  // Refs for new ticket sound notification

  const prevTicketIdsRef = useRef(new Set());

  const isInitialTicketLoadDoneRef = useRef(false);

  const fetchAllTickets = useCallback(async (isPollingRefresh = false) => {
    if (!isPollingRefresh) {
      setIsLoadingTickets(true);
    }

    // Tidak set error ke null di sini untuk polling, agar error fetch awal tidak hilang

    // Jika ingin error spesifik untuk polling list, bisa ditambahkan state terpisah

    try {
      const response = await fetch(`${API_BASE_URL}/tickets`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const transformedTickets = result.data
          .map((ticket) => {
            const createdAtDate = new Date(ticket.created_at);

            return {
              db_id: ticket.id,

              id: `TICKET-${createdAtDate.getFullYear()}${String(
                createdAtDate.getMonth() + 1
              ).padStart(2, "0")}${String(createdAtDate.getDate()).padStart(
                2,
                "0"
              )}-${String(ticket.id).padStart(3, "0")}`,

              subject: ticket.message?.split("\n")[0] || "Tanpa Subjek",

              user: ticket.name,

              email: ticket.sender,

              status: ticket.status === "open" ? "Open" : "Close",

              createdAt: ticket.created_at,

              updatedAt: ticket.updated_at,
            };
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        setAllTickets((currentAllTickets) => {
          if (
            JSON.stringify(currentAllTickets) !==
            JSON.stringify(transformedTickets)
          ) {
            // console.log("Updating allTickets state due to new data from server.");

            return transformedTickets;
          }

          return currentAllTickets;
        });
      } else {
        throw new Error("Format data tiket tidak sesuai dari server.");
      }
    } catch (err) {
      console.error("Gagal mengambil/refresh daftar tiket:", err);

      if (!isPollingRefresh) {
        setError("Gagal memuat daftar tiket. Silakan coba lagi nanti.");
      }

      // Untuk polling refresh, error hanya di-log, tidak mengubah UI secara drastis
    } finally {
      if (!isPollingRefresh) {
        setIsLoadingTickets(false);
      }
    }
  }, []); // Dependency array kosong agar fungsi fetchAllTickets stabil

  // Initial fetch for all tickets

  useEffect(() => {
    fetchAllTickets(false);
  }, [fetchAllTickets]);

  // Polling for the entire ticket list

  useEffect(() => {
    listPollingIntervalRef.current = setInterval(() => {
      // console.log('Polling for ticket list updates...');

      fetchAllTickets(true); // Pass true to indicate it's a polling refresh
    }, LIST_POLLING_INTERVAL);

    return () => {
      if (listPollingIntervalRef.current) {
        clearInterval(listPollingIntervalRef.current);
      }
    };
  }, [fetchAllTickets]);

  // Effect to play sound on new tickets

  useEffect(() => {
    if (isLoadingTickets) {
      // If tickets are currently being loaded for the first time, do nothing.

      return;
    }

    const currentTicketIds = new Set(allTickets.map((t) => t.db_id));

    if (!isInitialTicketLoadDoneRef.current) {
      // This is the first successful load (isLoadingTickets is false)

      prevTicketIdsRef.current = currentTicketIds;

      isInitialTicketLoadDoneRef.current = true;

      // console.log('Initial ticket load processed, sounds will be enabled for subsequent new tickets.');

      return;
    }

    // Check for new tickets by comparing current IDs with previous IDs

    const newlyAddedTickets = allTickets.filter(
      (ticket) => !prevTicketIdsRef.current.has(ticket.db_id)
    );

    if (newlyAddedTickets.length > 0) {
      console.log(
        `New ticket(s) detected (${newlyAddedTickets.length}), playing sound.`
      );

      playNotificationSound();
    }

    prevTicketIdsRef.current = currentTicketIds; // Update previous IDs for the next comparison
  }, [allTickets, isLoadingTickets]);

  // Effect to deselect ticket if it's no longer in allTickets after a list refresh

  useEffect(() => {
    if (selectedTicketDbId && allTickets.length > 0) {
      const ticketExists = allTickets.some(
        (ticket) => ticket.db_id === selectedTicketDbId
      );

      if (!ticketExists) {
        console.log(
          `Selected ticket ${selectedTicketDbId} no longer found in the updated list. Deselecting.`
        );

        setSelectedTicketDbId(null);
      }
    }

    // Jika daftar tiket menjadi kosong (misalnya karena filter atau error saat fetch awal) dan ada tiket yang terpilih
    else if (
      selectedTicketDbId &&
      allTickets.length === 0 &&
      !isLoadingTickets
    ) {
      console.log(
        `Ticket list is empty. Deselecting ticket ${selectedTicketDbId}.`
      );

      setSelectedTicketDbId(null);
    }
  }, [allTickets, selectedTicketDbId, isLoadingTickets]);

  const allFilteredTickets = useMemo(() => {
    return allTickets.filter((ticket) => {
      const searchTermLower = searchTerm.toLowerCase();

      const ticketIdLower = ticket.id.toLowerCase();

      const matchesId = ticketIdLower.includes(searchTermLower);

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

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
    if (
      ticketListContainerRef.current &&
      hasMore &&
      !isLoadingMoreTickets &&
      !isLoadingTickets
    ) {
      const { scrollTop, scrollHeight, clientHeight } =
        ticketListContainerRef.current;

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
  }, [
    currentPage,
    hasMore,
    isLoadingMoreTickets,
    isLoadingTickets,
    allFilteredTickets,
    loadDisplayedTickets,
  ]);

  useEffect(() => {
    const container = ticketListContainerRef.current;

    if (container) {
      container.addEventListener("scroll", handleScroll);

      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const fetchTicketDetail = useCallback(
    async (ticketDbId, isPolling = false) => {
      if (!isPolling) setIsLoadingDetail(true);

      if (!isPolling) setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/ticket/${ticketDbId}`);

        if (!response.ok) {
          if (!isPolling) {
            throw new Error(`HTTP error! status: ${response.status}`);
          } else {
            console.warn(
              `Polling Detail: HTTP error ${response.status} for ticket ${ticketDbId}.`
            );

            // Jika tiket tidak ditemukan saat polling detail, mungkin sudah dihapus.

            // Kita bisa memicu refresh daftar tiket utama di sini.

            if (response.status === 404) {
              fetchAllTickets(true); // Minta refresh daftar tiket
            }

            return;
          }
        }

        const data = await response.json();

        const transformedDetailFromPollOrFetch = {
          ...data,

          status:
            data.status === "open"
              ? "Open"
              : data.status === "closed"
              ? "Close"
              : data.status,

          messages: Array.isArray(data.messages)
            ? data.messages.sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
              )
            : [],

          updatedAt: data.updated_at || new Date().toISOString(),
        };

        setSelectedTicketDetail((currentDetail) => {
          if (!currentDetail && !isPolling)
            return transformedDetailFromPollOrFetch;

          if (!currentDetail && isPolling)
            return transformedDetailFromPollOrFetch; // Allow initial set from polling

          if (!currentDetail) return null; // Should not happen if checks above are right

          const messagesChanged =
            JSON.stringify(currentDetail.messages) !==
            JSON.stringify(transformedDetailFromPollOrFetch.messages);

          const statusChanged =
            currentDetail.status !== transformedDetailFromPollOrFetch.status;

          const updatedAtChanged =
            currentDetail.updatedAt !==
            transformedDetailFromPollOrFetch.updatedAt;

          if (messagesChanged || statusChanged || updatedAtChanged) {
            return transformedDetailFromPollOrFetch;
          }

          return currentDetail;
        });

        // Sinkronisasi allTickets jika ada perubahan dari polling detail

        if (
          isPolling &&
          selectedTicketDetail &&
          (selectedTicketDetail.status !==
            transformedDetailFromPollOrFetch.status ||
            selectedTicketDetail.updatedAt !==
              transformedDetailFromPollOrFetch.updatedAt)
        ) {
          setAllTickets((prevAll) =>
            prevAll
              .map((t) =>
                t.db_id === ticketDbId
                  ? {
                      ...t,

                      status: transformedDetailFromPollOrFetch.status,

                      updatedAt: transformedDetailFromPollOrFetch.updatedAt,
                    }
                  : t
              )
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          );
        }
      } catch (err) {
        console.error(
          `Gagal mengambil detail tiket ${ticketDbId}${
            isPolling ? " (polling)" : ""
          }:`,
          err
        );

        if (!isPolling) {
          setError(
            `Gagal memuat detail tiket. ID: ${ticketDbId}. ${err.message}`
          );

          setSelectedTicketDetail(null);
        }
      } finally {
        if (!isPolling) setIsLoadingDetail(false);
      }
    },
    [selectedTicketDetail, fetchAllTickets]
  ); // Tambahkan fetchAllTickets ke dependency

  useEffect(() => {
    if (detailPollingIntervalRef.current) {
      clearInterval(detailPollingIntervalRef.current);

      detailPollingIntervalRef.current = null;
    }

    if (selectedTicketDbId) {
      fetchTicketDetail(selectedTicketDbId, false);

      detailPollingIntervalRef.current = setInterval(() => {
        fetchTicketDetail(selectedTicketDbId, true);
      }, DETAIL_POLLING_INTERVAL);
    } else {
      setSelectedTicketDetail(null);
    }

    return () => {
      if (detailPollingIntervalRef.current) {
        clearInterval(detailPollingIntervalRef.current);
      }
    };
  }, [selectedTicketDbId, fetchTicketDetail]);

  useEffect(() => {
    if (chatMessagesAreaRef.current && selectedTicketDetail?.messages) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatMessagesAreaRef.current;

      const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 25;

      const prevMsgCount = parseInt(
        chatMessagesAreaRef.current.dataset.prevMsgCount || "0",
        10
      );

      const currentMsgCount = selectedTicketDetail.messages.length;

      if (isScrolledToBottom || currentMsgCount > prevMsgCount) {
        setTimeout(() => {
          if (chatMessagesAreaRef.current) {
            chatMessagesAreaRef.current.scrollTop =
              chatMessagesAreaRef.current.scrollHeight;
          }
        }, 0);
      }

      chatMessagesAreaRef.current.dataset.prevMsgCount =
        currentMsgCount.toString();
    }
  }, [selectedTicketDetail?.messages]);

  const handleSelectTicket = (db_id) => {
    setSelectedTicketDbId(db_id);
  };

  const handleOpenStatusModal = () => {
    if (!selectedTicketDetail) return;

    const currentStatusDisplay = selectedTicketDetail.status;

    const newStatusBackend =
      currentStatusDisplay === "Open" ? "closed" : "open";

    const newStatusDisplay = newStatusBackend === "open" ? "Open" : "Close";

    setStatusToChange({
      dbId: selectedTicketDbId,

      newStatusBackend,

      newStatusDisplay,
    });

    setIsStatusModalOpen(true);
  };

  const handleConfirmUpdateStatus = async () => {
    if (!statusToChange.dbId || !selectedTicketDetail) return;

    setIsUpdatingStatus(true);

    setError(null);

    const originalTicketDetail = JSON.parse(
      JSON.stringify(selectedTicketDetail)
    );

    const originalAllTickets = JSON.parse(JSON.stringify(allTickets));

    const newUpdatedAt = new Date().toISOString();

    setSelectedTicketDetail((prev) =>
      prev
        ? {
            ...prev,
            status: statusToChange.newStatusDisplay,
            updatedAt: newUpdatedAt,
          }
        : null
    );

    setAllTickets((prevAllTickets) =>
      prevAllTickets
        .map((ticket) =>
          ticket.db_id === statusToChange.dbId
            ? {
                ...ticket,
                status: statusToChange.newStatusDisplay,
                updatedAt: newUpdatedAt,
              }
            : ticket
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/ticket/status/${statusToChange.dbId}`,
        {
          method: "PATCH",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ status: statusToChange.newStatusBackend }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            `Gagal memperbarui status tiket (status: ${response.status})`
        );
      }

      if (result.data && result.data.updated_at) {
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, updatedAt: result.data.updated_at } : null
        );

        setAllTickets((prevAllTickets) =>
          prevAllTickets
            .map((ticket) =>
              ticket.db_id === statusToChange.dbId
                ? { ...ticket, updatedAt: result.data.updated_at }
                : ticket
            )
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        );
      } else {
        fetchTicketDetail(statusToChange.dbId, false);
      }

      setError(null);

      console.log("Status tiket berhasil diperbarui:", result.message);
    } catch (err) {
      console.error("Gagal memperbarui status tiket:", err);

      setError(
        `Gagal memperbarui status: ${err.message}. Perubahan dibatalkan.`
      );

      setSelectedTicketDetail(originalTicketDetail);

      setAllTickets(originalAllTickets);
    } finally {
      setIsUpdatingStatus(false);

      setIsStatusModalOpen(false);

      setStatusToChange({
        dbId: null,
        newStatusBackend: "",
        newStatusDisplay: "",
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (
      !newMessage.trim() ||
      !selectedTicketDbId ||
      !selectedTicketDetail ||
      selectedTicketDetail.status === "Close"
    )
      return;

    const tempMessageId = `temp-${Date.now()}`;

    const agentMessageForUI = {
      id: tempMessageId,

      sender: "Agen Helpdesk",

      text: newMessage.trim(),

      timestamp: new Date().toISOString(),

      type: "agent",
    };

    const previousMessages = selectedTicketDetail.messages
      ? [...selectedTicketDetail.messages]
      : [];

    setSelectedTicketDetail((prev) =>
      prev
        ? {
            ...prev,

            messages: [...previousMessages, agentMessageForUI],

            updatedAt: agentMessageForUI.timestamp,
          }
        : null
    );

    setAllTickets((prevAll) =>
      prevAll
        .map((t) =>
          t.db_id === selectedTicketDbId
            ? { ...t, updatedAt: agentMessageForUI.timestamp }
            : t
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );

    const originalMessageInput = newMessage;

    setNewMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/send-message`, {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          ticket_id: selectedTicketDbId,

          message: originalMessageInput.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response
          .json()
          .catch(() => ({
            message: "Gagal mengirim pesan, respons tidak valid.",
          }));

        throw new Error(
          errData.message || `HTTP error! status: ${response.status}`
        );
      }

      const result = await response.json();

      if (result.success && result.data && result.data.message) {
        const sentMessageFromServer = {
          ...result.data.message,

          type: "agent",
        };

        setSelectedTicketDetail((prev) => {
          if (!prev) return null;

          const finalMessages = prev.messages.map((msg) =>
            msg.id === tempMessageId ? sentMessageFromServer : msg
          );

          return {
            ...prev,

            messages: finalMessages,

            updatedAt: new Date(
              result.data.ticket_updated_at || sentMessageFromServer.timestamp
            ).toISOString(),
          };
        });

        if (result.data.ticket_updated_at) {
          setAllTickets((prevAll) =>
            prevAll
              .map((t) =>
                t.db_id === selectedTicketDbId
                  ? {
                      ...t,
                      updatedAt: new Date(
                        result.data.ticket_updated_at
                      ).toISOString(),
                    }
                  : t
              )
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          );
        }
      } else {
        console.warn(
          "Pesan terkirim, tapi tidak ada data pesan balikan. Mengandalkan polling atau fetch berikutnya."
        );

        fetchTicketDetail(selectedTicketDbId, false);
      }
    } catch (err) {
      console.error("Gagal mengirim pesan:", err);

      setError(
        `Gagal mengirim pesan: ${err.message}. Pesan mungkin tidak terkirim.`
      );

      setSelectedTicketDetail((prev) =>
        prev ? { ...prev, messages: previousMessages } : null
      );

      setNewMessage(originalMessageInput);
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

        {error && !error.toLowerCase().includes("polling") && (
          <div className="error-message">
            {error}{" "}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Tutup
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-full md:w-1/3 bg-slate-100 border-r border-slate-300 p-4 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">
              Daftar Tiket
            </h2>

            <div className="search-filter-area mb-4 space-y-3">
              <input
                type="text"
                placeholder="Cari Kode Tiket..."
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

            <div
              id="ticket-items-container"
              ref={ticketListContainerRef}
              className="flex-1 overflow-y-auto min-h-0"
            >
              {isLoadingTickets ? (
                <div className="loading-indicator">Memuat daftar tiket...</div>
              ) : (
                <>
                  <TicketList
                    tickets={displayedTickets}
                    onSelectTicket={handleSelectTicket}
                    selectedTicketDbId={selectedTicketDbId}
                  />

                  {isLoadingMoreTickets && (
                    <div className="loading-indicator">
                      Memuat tiket lainnya...
                    </div>
                  )}

                  {!isLoadingMoreTickets &&
                    !hasMore &&
                    displayedTickets.length > 0 &&
                    allFilteredTickets.length > 0 && (
                      <div className="text-center p-3 text-slate-500 text-sm">
                        Semua tiket telah dimuat.
                      </div>
                    )}

                  {!isLoadingTickets && allFilteredTickets.length === 0 && (
                    <div className="flex justify-center items-center h-full text-slate-500 p-4 text-center">
                      Tidak ada tiket yang cocok dengan filter Anda.
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          <main className="w-full md:w-2/3 bg-white p-0 flex-col hidden md:flex">
            {isLoadingDetail && !selectedTicketDetail ? (
              <div className="flex justify-center items-center h-full text-slate-500 text-lg">
                Memuat detail tiket...
              </div>
            ) : !selectedTicketDetail ? (
              <div className="flex justify-center items-center h-full text-slate-500 text-lg p-4 text-center">
                Pilih tiket dari daftar untuk melihat percakapan.
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-indigo-700">
                        {selectedTicketDetail.id}
                      </h3>

                      <p className="text-md text-slate-600">
                        {selectedTicketDetail.subject}
                      </p>
                    </div>

                    <button
                      onClick={handleOpenStatusModal}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 text-white flex items-center space-x-2 ${
                        selectedTicketDetail.status === "Open"
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-green-500 hover:bg-green-600"
                      }`}
                      disabled={isUpdatingStatus}
                    >
                      <span>
                        {selectedTicketDetail.status === "Open"
                          ? "Tutup Tiket"
                          : "Buka Kembali"}
                      </span>
                    </button>
                  </div>

                  <div className="mt-2 text-sm text-slate-500 space-y-0.5">
                    <p>
                      Pelapor:{" "}
                      <span className="font-medium">
                        {selectedTicketDetail.user}
                      </span>{" "}
                      (
                      <span className="font-medium">
                        {selectedTicketDetail.email}
                      </span>
                      )
                    </p>

                    <p>
                      Status:{" "}
                      <span
                        className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                          selectedTicketDetail.status === "Open"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {selectedTicketDetail.status}
                      </span>
                    </p>

                    <p>
                      Agen:{" "}
                      <span className="font-medium">
                        {selectedTicketDetail.agent || "-"}
                      </span>
                    </p>

                    <p>
                      Dibuat:{" "}
                      <span className="font-medium">
                        {formatDate(selectedTicketDetail.createdAt)}
                      </span>
                    </p>

                    <p>
                      Update:{" "}
                      <span className="font-medium">
                        {formatDate(selectedTicketDetail.updatedAt)}
                      </span>
                    </p>
                  </div>
                </div>

                <div
                  id="chat-messages-area"
                  ref={chatMessagesAreaRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 flex flex-col min-h-0"
                >
                  {selectedTicketDetail.messages.map((msg) => (
                    <ChatBubble
                      key={msg.id || `msg-${msg.timestamp}-${Math.random()}`}
                      message={msg}
                    />
                  ))}

                  {selectedTicketDetail.messages.length === 0 && (
                    <p className="text-center text-slate-500">
                      Belum ada pesan dalam tiket ini.
                    </p>
                  )}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-slate-200 bg-white"
                >
                  <div className="flex items-center space-x-2">
                    <textarea
                      placeholder={
                        selectedTicketDetail.status === "Close"
                          ? "Tiket sudah ditutup."
                          : "Ketik balasan Anda..."
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                      rows="2"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();

                          handleSendMessage(e);
                        }
                      }}
                      disabled={
                        isUpdatingStatus ||
                        selectedTicketDetail.status === "Close"
                      }
                    />

                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-150 disabled:opacity-50"
                      disabled={
                        isUpdatingStatus ||
                        !newMessage.trim() ||
                        selectedTicketDetail.status === "Close"
                      }
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

      <ConfirmModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onConfirm={handleConfirmUpdateStatus}
        title={`Konfirmasi ${
          statusToChange.newStatusBackend === "closed"
            ? "Penutupan"
            : "Pembukaan Kembali"
        } Tiket`}
        confirmText={`${
          statusToChange.newStatusBackend === "closed"
            ? "Ya, Tutup Tiket"
            : "Ya, Buka Tiket"
        }`}
        isLoading={isUpdatingStatus}
      >
        Apakah Anda yakin ingin{" "}
        {statusToChange.newStatusBackend === "closed"
          ? "menutup"
          : "membuka kembali"}{" "}
        tiket ini?
        {statusToChange.newStatusBackend === "closed" &&
          selectedTicketDetail?.id && (
            <p className="text-sm text-amber-700 mt-2 bg-amber-100 p-2 rounded">
              Pelapor akan menerima notifikasi bahwa tiket{" "}
              <span className="font-semibold">{selectedTicketDetail.id}</span>{" "}
              telah ditutup.
            </p>
          )}
      </ConfirmModal>
    </>
  );
}

export default App;
