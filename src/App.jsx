import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Routes, Route, useNavigate, Navigate, Outlet } from 'react-router-dom';
import Login from './login';
import ComplaintModal from './ComplaintModal';

// --- START: HelpdeskDashboard ---

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ITEMS_PER_PAGE = 15;
const DETAIL_POLLING_INTERVAL = 5000;
const LIST_POLLING_INTERVAL = 5000;
const COMPLAINT_REPORT_URL_BASE = import.meta.env.VITE_HELPDESK_COMPLAINT_REPORT_URL_BASE;


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

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  isLoading,
  children,
  ticketDetails,
  showSolusiInput,
  solusiValue,
  onSolusiChange,
  isSolusiRequired,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4 text-slate-800">{title}</h3>
        {children || <p className="text-slate-600 mb-2">{message}</p>}

        {ticketDetails && (
          <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-200 text-sm">
            {ticketDetails.namaPelapor && (
              <p className="text-slate-700">
                <span className="font-medium">Nama Pelapor:</span> {ticketDetails.namaPelapor}
              </p>
            )}
            {ticketDetails.gm && (
              <p className="text-slate-700">
                <span className="font-medium">GM:</span> {ticketDetails.gm}
              </p>
            )}
            {/* Menampilkan Lokasi (Nama) di modal konfirmasi jika ada */}
            {ticketDetails.locationName && (
              <p className="text-slate-700">
                <span className="font-medium">Lokasi:</span> {ticketDetails.locationName}
              </p>
            )}
            {ticketDetails.kendala && (
              <p className="text-slate-700">
                <span className="font-medium">Kendala:</span> {ticketDetails.kendala}
              </p>
            )}
          </div>
        )}

        {showSolusiInput && (
          <div className="mb-6">
            <label htmlFor="solusiInputModal" className="block text-sm font-medium text-slate-700 mb-1">
              Solusi <span className="text-red-500">*</span>
            </label>
            <textarea
              id="solusiInputModal"
              rows="3"
              className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              value={solusiValue}
              onChange={onSolusiChange}
              placeholder="Masukkan solusi untuk tiket ini..."
            />
            {isSolusiRequired && !solusiValue?.trim() && (
                <p className="text-xs text-red-500 mt-1">Solusi wajib diisi untuk menutup tiket.</p>
            )}
          </div>
        )}

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
            disabled={isLoading || (showSolusiInput && isSolusiRequired && !solusiValue?.trim())}
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
      : ticket.status === "Pending"
      ? "bg-yellow-100 text-yellow-800" 
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
      {/* Menampilkan Lokasi (Nama) di item tiket jika ada, fallback ke Kode Lokasi */}
      <p className="text-xs text-slate-500">
        Lokasi: {ticket.location_name || ticket.location_code || "N/A"}
      </p>
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

  const alignmentClass = isUser ? "justify-start" : "justify-end";

  return (
    <div className={`flex ${alignmentClass} w-full`}>
      <div
        className={`max-w-[70%] p-2.5 rounded-2xl mb-2 break-words shadow-sm ${bubbleClass}`}
      >
        <p className="font-medium text-sm">{message.sender}</p>
        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        <p className="text-xs text-right mt-1 opacity-75">
          {formatDate(message.timestamp)}
        </p>
      </div>
    </div>
  );
});

const getAuthToken = () => localStorage.getItem('authToken');

const HelpdeskDashboard = ({ onLogout }) => {
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
  const prevTicketIdsRef = useRef(new Set());
  const isInitialTicketLoadDoneRef = useRef(false);
  const [solusiInput, setSolusiInput] = useState("");
  const [agentName, setAgentName] = useState("");

  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [complaintTicketIdChat, setComplaintTicketIdChat] = useState(null);
  const [complaintTicketFullDetails, setComplaintTicketFullDetails] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  const [complaintLinks, setComplaintLinks] = useState({});

  const prevScrollHeightRef = useRef();

  useEffect(() => {
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
        try {
            const userData = JSON.parse(storedUserData);
            if (userData && userData.name) {
                setAgentName(userData.name);
            } else if (userData && userData.username) {
                setAgentName(userData.username);
            } else {
                setAgentName("Agent");
            }
        } catch (e) {
            console.error("Gagal memparsing data pengguna dari localStorage:", e);
            setAgentName("Agent");
        }
    } else {
        setAgentName("Agent");
    }
  }, []);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);


  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const token = getAuthToken();
    if (!token) {
      console.error("No auth token found. Logging out.");
      onLogout();
      throw new Error("Tidak ada token otentikasi.");
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
    if (options.body && !(options.body instanceof FormData) && options.method !== 'GET' && options.method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
      console.error("Authentication error. Logging out.", response.status);
      onLogout();
      throw new Error(`Error Otentikasi: ${response.status}`);
    }
    return response;
  }, [onLogout]);

  const fetchAllTickets = useCallback(async (isPollingRefresh = false) => {
    if (!isPollingRefresh) {
      setIsLoadingTickets(true);
    }
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/tickets`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const transformedTickets = result.data
          .map((ticket) => {
            const createdAtDate = new Date(ticket.created_at);
            if (ticket.id_ticket && ticket.complaint_ticket_id_ref && ticket.complaint_category_ref) {
                setComplaintLinks(prevLinks => ({
                    ...prevLinks,
                    [ticket.id_ticket]: { 
                        complaintId: ticket.complaint_ticket_id_ref,
                        category: ticket.complaint_category_ref
                    }
                }));
            }
            return {
              db_id: ticket.id, 
              id: ticket.id_ticket || `TICKET-${createdAtDate.getFullYear()}${String(
                createdAtDate.getMonth() + 1
              ).padStart(2, "0")}${String(createdAtDate.getDate()).padStart(
                2,
                "0"
              )}-${String(ticket.id).padStart(3, "0")}`,
              subject: ticket.message?.split("\n")[0] || "Tanpa Subjek",
              user: ticket.name,
              email: ticket.sender,
              status: ticket.status === "open" ? "Open" : ticket.status === "pending" ? "Pending" : "Close",
              createdAt: ticket.created_at,
              updatedAt: ticket.updated_at,
              location_code: ticket.location_code,
              location_name: ticket.location_name, // Pastikan location_name diambil
              complaint_ticket_id_ref: ticket.complaint_ticket_id_ref,
              complaint_category_ref: ticket.complaint_category_ref,
            };
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setAllTickets((currentAllTickets) => {
          if (
            JSON.stringify(currentAllTickets) !==
            JSON.stringify(transformedTickets)
          ) {
            return transformedTickets;
          }
          return currentAllTickets;
        });
      } else {
        throw new Error("Format data tiket tidak sesuai dari server.");
      }
    } catch (err) {
      console.error("Gagal mengambil/refresh daftar tiket:", err);
      if (!isPollingRefresh && err.message !== "Tidak ada token otentikasi." && !err.message.startsWith("Error Otentikasi:")) {
         setError("Gagal memuat daftar tiket. Silakan coba lagi nanti.");
      }
    } finally {
      if (!isPollingRefresh) {
        setIsLoadingTickets(false);
      }
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchAllTickets(false);
  }, [fetchAllTickets]);

  useEffect(() => {
    if (allTickets.length > 0) {
        const initialLinks = {};
        allTickets.forEach(ticket => {
            if (ticket.id && ticket.complaint_ticket_id_ref && ticket.complaint_category_ref) {
                initialLinks[ticket.id] = { 
                    complaintId: ticket.complaint_ticket_id_ref,
                    category: ticket.complaint_category_ref
                };
            }
        });
        setComplaintLinks(prevLinks => ({ ...prevLinks, ...initialLinks }));
    }
  }, [allTickets]);


  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
        if (listPollingIntervalRef.current) clearInterval(listPollingIntervalRef.current);
        return;
    }
    listPollingIntervalRef.current = setInterval(() => {
      fetchAllTickets(true);
    }, LIST_POLLING_INTERVAL);
    return () => {
      if (listPollingIntervalRef.current) {
        clearInterval(listPollingIntervalRef.current);
      }
    };
  }, [fetchAllTickets]);

  useEffect(() => {
    if (isLoadingTickets) {
      return;
    }
    const currentTicketIds = new Set(allTickets.map((t) => t.db_id));
    if (!isInitialTicketLoadDoneRef.current) {
      prevTicketIdsRef.current = currentTicketIds;
      isInitialTicketLoadDoneRef.current = true;
      return;
    }
    const newlyAddedTickets = allTickets.filter(
      (ticket) => !prevTicketIdsRef.current.has(ticket.db_id)
    );
    if (newlyAddedTickets.length > 0) {
      playNotificationSound();
    }
    prevTicketIdsRef.current = currentTicketIds;
  }, [allTickets, isLoadingTickets]);

  useEffect(() => {
    if (selectedTicketDbId && allTickets.length > 0) {
      const ticketExists = allTickets.some(
        (ticket) => ticket.db_id === selectedTicketDbId
      );
      if (!ticketExists) {
        setSelectedTicketDbId(null);
        setSelectedTicketDetail(null);
      }
    } else if (
      selectedTicketDbId &&
      allTickets.length === 0 &&
      !isLoadingTickets
    ) {
      setSelectedTicketDbId(null);
      setSelectedTicketDetail(null);
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
    async (ticketDbIdToFetch, isPolling = false) => {
      if (!isPolling) setIsLoadingDetail(true);
      if (!isPolling) setError(null);
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/ticket/${ticketDbIdToFetch}`);
        if (!response.ok) {
          if (!isPolling) {
            throw new Error(`HTTP error! status: ${response.status}`);
          } else {
            if (response.status === 404) {
              fetchAllTickets(true); 
            }
            return;
          }
        }
        const data = await response.json();
        const transformedDetail = { 
          ...data,
          status:
            data.status === "open"
              ? "Open"
              : data.status === "pending"
              ? "Pending"
              : data.status === "closed"
              ? "Close"
              : data.status,
          messages: Array.isArray(data.messages)
            ? data.messages.sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
              )
            : [],
          updatedAt: data.updated_at || new Date().toISOString(),
          location_code: data.location_code || null,
          location_name: data.location_name || null, // Pastikan location_name diambil
          solusi: data.solusi || null,
          complaint_ticket_id_ref: data.complaint_ticket_id_ref,
          complaint_category_ref: data.complaint_category_ref,
        };

        if (transformedDetail.id && transformedDetail.complaint_ticket_id_ref && transformedDetail.complaint_category_ref) {
            setComplaintLinks(prevLinks => ({
                ...prevLinks,
                [transformedDetail.id]: { 
                    complaintId: transformedDetail.complaint_ticket_id_ref,
                    category: transformedDetail.complaint_category_ref
                }
            }));
        }

        setSelectedTicketDetail((currentDetail) => {
          if (!currentDetail && !isPolling)
            return transformedDetail;
          if (!currentDetail && isPolling)
            return transformedDetail;
          if (!currentDetail) return null;

          const messagesChanged =
            JSON.stringify(currentDetail.messages) !==
            JSON.stringify(transformedDetail.messages);
          const statusChanged =
            currentDetail.status !== transformedDetail.status;
          const updatedAtChanged =
            currentDetail.updatedAt !==
            transformedDetail.updatedAt;
          const solusiChanged = currentDetail.solusi !== transformedDetail.solusi;
          const complaintRefChanged = currentDetail.complaint_ticket_id_ref !== transformedDetail.complaint_ticket_id_ref ||
                                    currentDetail.complaint_category_ref !== transformedDetail.complaint_category_ref;
          const locationNameChanged = currentDetail.location_name !== transformedDetail.location_name;


          if (messagesChanged || statusChanged || updatedAtChanged || solusiChanged || complaintRefChanged || locationNameChanged) {
            return transformedDetail;
          }
          return currentDetail;
        });

        if (
          isPolling &&
          selectedTicketDetail &&
          (selectedTicketDetail.status !== transformedDetail.status ||
           selectedTicketDetail.updatedAt !== transformedDetail.updatedAt ||
           selectedTicketDetail.location_name !== transformedDetail.location_name ) // Cek perubahan location_name
        ) {
          setAllTickets((prevAll) =>
            prevAll
              .map((t) =>
                t.db_id === ticketDbIdToFetch
                  ? {
                      ...t,
                      status: transformedDetail.status,
                      updatedAt: transformedDetail.updatedAt,
                      location_code: transformedDetail.location_code,
                      location_name: transformedDetail.location_name, // Update location_name di list
                      complaint_ticket_id_ref: transformedDetail.complaint_ticket_id_ref, 
                      complaint_category_ref: transformedDetail.complaint_category_ref,  
                    }
                  : t
              )
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          );
        }
      } catch (err) {
        console.error(
          `Gagal mengambil detail tiket ${ticketDbIdToFetch}${
            isPolling ? " (polling)" : ""
          }:`,
          err
        );
        if (!isPolling && err.message !== "Tidak ada token otentikasi." && !err.message.startsWith("Error Otentikasi:")) {
          setError(
            `Gagal memuat detail tiket. ID DB: ${ticketDbIdToFetch}. ${err.message}`
          );
          setSelectedTicketDetail(null);
        }
      } finally {
        if (!isPolling) setIsLoadingDetail(false);
      }
    },
    [selectedTicketDetail, fetchAllTickets, fetchWithAuth] 
  );

  useEffect(() => {
    if (detailPollingIntervalRef.current) {
      clearInterval(detailPollingIntervalRef.current);
      detailPollingIntervalRef.current = null;
    }
    const token = getAuthToken();
    if (!token) {
        setSelectedTicketDetail(null);
        return;
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
    const chatArea = chatMessagesAreaRef.current;

    if (chatArea) {
        if (!chatArea.dataset.currentTicketId) {
            chatArea.dataset.currentTicketId = "null";
        }
        if (!chatArea.dataset.prevMsgCount) {
            chatArea.dataset.prevMsgCount = "0";
        }
    }

    if (!chatArea || !selectedTicketDetail?.messages) {
        if (prevScrollHeightRef.current !== undefined) {
            prevScrollHeightRef.current = undefined;
        }
        if (chatArea && !selectedTicketDetail?.db_id && chatArea.dataset.currentTicketId !== "null") {
            chatArea.dataset.currentTicketId = "null";
            chatArea.dataset.prevMsgCount = "0";
        }
        return;
    }

    const { scrollTop, scrollHeight, clientHeight } = chatArea;
    const currentTicketIdStr = String(selectedTicketDetail.db_id);

    let prevMsgCount;
    let scrollHeightBeforeUpdate = prevScrollHeightRef.current;

    if (chatArea.dataset.currentTicketId === currentTicketIdStr) {
        prevMsgCount = parseInt(chatArea.dataset.prevMsgCount || "0", 10);
        if (scrollHeightBeforeUpdate === undefined) {
            scrollHeightBeforeUpdate = scrollHeight;
        }
    } else {
        prevMsgCount = 0;
        chatArea.dataset.prevMsgCount = "0";
        chatArea.dataset.currentTicketId = currentTicketIdStr;
        scrollHeightBeforeUpdate = scrollHeight;
    }

    const currentMsgCount = selectedTicketDetail.messages.length;
    const hasNewMessages = currentMsgCount > prevMsgCount;
    const atBottomThreshold = 30;
    const wasAtBottomBeforeUpdate = (scrollHeightBeforeUpdate !== undefined)
        ? (scrollHeightBeforeUpdate - scrollTop <= clientHeight + atBottomThreshold)
        : true;
    let shouldScrollToBottom = false;

    if (prevMsgCount === 0 && currentMsgCount > 0) {
        shouldScrollToBottom = true;
    } else if (hasNewMessages && wasAtBottomBeforeUpdate) {
        shouldScrollToBottom = true;
    }

    if (shouldScrollToBottom) {
        requestAnimationFrame(() => {
            if (chatMessagesAreaRef.current) {
                chatMessagesAreaRef.current.scrollTop = chatMessagesAreaRef.current.scrollHeight;
            }
        });
    }

    prevScrollHeightRef.current = scrollHeight;
    if (chatArea) {
       chatArea.dataset.prevMsgCount = currentMsgCount.toString();
    }

}, [selectedTicketDetail?.messages, selectedTicketDetail?.db_id]);


  const handleSelectTicket = (db_id) => {
    setSelectedTicketDbId(db_id);
  };

  const handleOpenStatusModal = () => {
    if (!selectedTicketDetail) return;
    const currentStatusDisplay = selectedTicketDetail.status;
    const newStatusBackend =
      currentStatusDisplay === "Open" || currentStatusDisplay === "Pending" ? "closed" : "open";
    const newStatusDisplay = newStatusBackend === "open" ? "Open" : "Close"; 
    
    setStatusToChange({
      dbId: selectedTicketDbId,
      newStatusBackend,
      newStatusDisplay,
    });
    if (newStatusBackend === "closed") {
        setSolusiInput(selectedTicketDetail.solusi || "");
    } else {
        setSolusiInput("");
    }
    setIsStatusModalOpen(true);
  };

  const handleConfirmUpdateStatus = async () => {
    if (!statusToChange.dbId || !selectedTicketDetail) return;

    if (statusToChange.newStatusBackend === "closed" && !solusiInput.trim()) {
        return;
    }

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
            solusi: statusToChange.newStatusBackend === "closed" ? solusiInput : prev.solusi,
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
      const requestBody = { status: statusToChange.newStatusBackend };
      if (statusToChange.newStatusBackend === "closed") {
        requestBody.solusi = solusiInput.trim();
      }

      const response = await fetchWithAuth(
        `${API_BASE_URL}/ticket/status/${statusToChange.dbId}`,
        {
          method: "PATCH",
          body: JSON.stringify(requestBody),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            `Gagal memperbarui status tiket (status: ${response.status})`
        );
      }
      fetchTicketDetail(statusToChange.dbId, false);
      setError(null);
    } catch (err) {
      console.error("Gagal memperbarui status tiket:", err);
      if (err.message !== "Tidak ada token otentikasi." && !err.message.startsWith("Error Otentikasi:")) {
        setError(
          `Gagal memperbarui status: ${err.message}. Perubahan dibatalkan.`
        );
      }
      setSelectedTicketDetail(originalTicketDetail);
      setAllTickets(originalAllTickets);
    } finally {
      setIsUpdatingStatus(false);
      if (!(statusToChange.newStatusBackend === "closed" && !solusiInput.trim()) || error === null) {
          setIsStatusModalOpen(false);
        setSolusiInput("");
          setStatusToChange({
            dbId: null,
            newStatusBackend: "",
            newStatusDisplay: "",
          });
      }
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
      sender: agentName,
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
      const response = await fetchWithAuth(`${API_BASE_URL}/send-message`, {
        method: "POST",
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
      fetchTicketDetail(selectedTicketDbId, false);

    } catch (err) {
      console.error("Gagal mengirim pesan:", err);
      if (err.message !== "Tidak ada token otentikasi." && !err.message.startsWith("Error Otentikasi:")) {
        setError(
          `Gagal mengirim pesan: ${err.message}. Pesan mungkin tidak terkirim.`
        );
      }
      setSelectedTicketDetail((prev) =>
        prev ? { ...prev, messages: previousMessages } : null
      );
      setNewMessage(originalMessageInput);
    }
  };

  const handleOpenComplaintModal = () => {
    if (selectedTicketDetail) {
      setComplaintTicketIdChat(selectedTicketDetail.id); 
      setComplaintTicketFullDetails(selectedTicketDetail); // Mengirim semua detail tiket
      setIsComplaintModalOpen(true);
    }
  };

  const handleComplaintSubmissionSuccess = (result) => {
    console.log("Komplain berhasil dibuat:", result);
    setIsComplaintModalOpen(false);
    setToast({
        show: true,
        message: `Komplain berhasil dibuat dengan ID: ${result.complaintTicketId}`,
        type: "success",
    });
    setComplaintLinks(prev => ({
        ...prev,
        [result.originalTicketIdChat]: { 
            complaintId: result.complaintTicketId,
            category: result.category
        }
    }));
    if (selectedTicketDbId) {
        fetchTicketDetail(selectedTicketDbId, false);
        fetchAllTickets(true); 
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
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-[1000] p-4 rounded-lg shadow-lg text-white transition-opacity duration-300 ease-in-out
            ${toast.type === "success" ? "bg-green-600" : ""}
            ${toast.type === "error" ? "bg-red-600" : ""}
            ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          role="alert"
        >
          {toast.message}
          <button
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            className="ml-4 font-bold text-lg leading-none hover:text-gray-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      )}

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

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
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
              <option value="Pending">Pending</option> 
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
                    <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-indigo-700">
                            {selectedTicketDetail.id} 
                        </h3>
                        {complaintLinks[selectedTicketDetail.id] ? ( 
                            <a
                                href={`${COMPLAINT_REPORT_URL_BASE}/${complaintLinks[selectedTicketDetail.id].complaintId}/${encodeURIComponent(complaintLinks[selectedTicketDetail.id].category)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm transition-colors duration-150"
                                title="Lihat Tiket Komplain"
                            >
                                View Complaint Ticket
                            </a>
                        ) : (
                            <button
                                onClick={handleOpenComplaintModal}
                                className="px-3 py-1 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-sm transition-colors duration-150"
                                title="Buat Komplain untuk Tiket Ini"
                                disabled={!selectedTicketDetail || selectedTicketDetail.status !== 'Open'}
                            >
                                Create complaint ticket
                            </button>
                        )}
                    </div>
                    <p className="text-md text-slate-600">
                      {selectedTicketDetail.subject}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenStatusModal}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 text-white flex items-center space-x-2 ${
                      selectedTicketDetail.status === "Open" || selectedTicketDetail.status === "Pending"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-green-500 hover:bg-green-600" 
                    }`}
                    disabled={isUpdatingStatus}
                  >
                    <span>
                      {selectedTicketDetail.status === "Open" || selectedTicketDetail.status === "Pending"
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
                    GM:{" "}
                    <span className="font-medium">
                      {selectedTicketDetail.location_code || "N/A"}
                    </span>
                  </p>
                  {/* Menampilkan Nama Lokasi di detail tiket */}
                  <p>
                    Lokasi:{" "}
                    <span className="font-medium">
                      {selectedTicketDetail.location_name || "N/A"}
                    </span>
                  </p>
                  <p>
                    Status:{" "}
                    <span
                      className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                        selectedTicketDetail.status === "Open"
                          ? "bg-green-100 text-green-800"
                          : selectedTicketDetail.status === "Pending"
                          ? "bg-yellow-100 text-yellow-800" 
                          : "bg-red-100 text-red-800" 
                      }`}
                    >
                      {selectedTicketDetail.status}
                    </span>
                  </p>
                  {selectedTicketDetail.status === "Close" && selectedTicketDetail.solusi && (
                     <p>
                        Solusi:{" "}
                        <span className="font-medium whitespace-pre-wrap">
                          {selectedTicketDetail.solusi}
                        </span>
                      </p>
                  )}
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
                className="flex-1 overflow-y-auto p-4 space-y-0 bg-slate-50 flex flex-col min-h-0"
              >
                {selectedTicketDetail.messages.map((msg) => (
                  <ChatBubble
                    key={msg.id || `msg-${msg.timestamp}-${Math.random()}`}
                    message={msg}
                  />
                ))}
                {selectedTicketDetail.messages.length === 0 && (
                  <p className="text-center text-slate-500 m-auto">
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

      <ConfirmModal
        isOpen={isStatusModalOpen}
        onClose={() => {
            setIsStatusModalOpen(false);
            setSolusiInput("");
            setError(null);
        }}
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
        ticketDetails={ // Menambahkan locationName ke modal konfirmasi
          statusToChange.newStatusBackend === "closed" && selectedTicketDetail
            ? {
                namaPelapor: selectedTicketDetail.user,
                gm: selectedTicketDetail.location_code || "N/A",
                locationName: selectedTicketDetail.location_name || "N/A", // Menambahkan location_name
                kendala: selectedTicketDetail.subject,
              }
            : null
        }
        showSolusiInput={statusToChange.newStatusBackend === "closed"}
        solusiValue={solusiInput}
        onSolusiChange={(e) => setSolusiInput(e.target.value)}
        isSolusiRequired={statusToChange.newStatusBackend === "closed"}
      >
        {! (statusToChange.newStatusBackend === "closed" && selectedTicketDetail) && (
             <p className="text-slate-600 mb-2">
                Apakah Anda yakin ingin{" "}
                {statusToChange.newStatusBackend === "closed"
                ? "menutup"
                : "membuka kembali"}{" "}
                tiket ini?
            </p>
        )}
        {statusToChange.newStatusBackend === "closed" &&
          selectedTicketDetail?.id && (
            <p className="text-sm text-amber-700 mt-2 bg-amber-100 p-2 rounded">
              Pelapor akan menerima notifikasi bahwa tiket{" "}
              <span className="font-semibold">{selectedTicketDetail.id}</span>{" "}
              telah ditutup.
            </p>
          )}
      </ConfirmModal>

      {isComplaintModalOpen && selectedTicketDetail && (
        <ComplaintModal
            isOpen={isComplaintModalOpen}
            onClose={() => setIsComplaintModalOpen(false)}
            ticketIdChat={complaintTicketIdChat} 
            ticketDetails={complaintTicketFullDetails} // Mengirim semua detail tiket, termasuk location_name
            fetchWithAuth={fetchWithAuth}
            apiBaseUrl={API_BASE_URL}
            onComplaintSubmitted={handleComplaintSubmissionSuccess}
        />
      )}
    </>
  );
};
// --- END: HelpdeskDashboard ---


// Main Layout Component
const MainLayout = ({ isAuthenticated, onLogout }) => {
  return (
    <div className="flex flex-col h-screen text-gray-800">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Helpdesk</h1>
        {isAuthenticated && (
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors duration-150"
          >
            Logout
          </button>
        )}
      </header>
      <Outlet />
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};


// New App component for routing
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  const navigate = useNavigate();

  const handleLoginSuccess = (data) => {
    if (data && data.token) {
      localStorage.setItem('authToken', data.token);
      if (data.user) {
        localStorage.setItem('userData', JSON.stringify(data.user));
      }
      setIsAuthenticated(true);
      navigate('/');
    } else {
      console.error("Login success called, but token is missing in data:", data);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const currentPath = window.location.pathname;
    if (isAuthenticated && currentPath === '/login') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);


  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />
        }
      />
      <Route
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <MainLayout isAuthenticated={isAuthenticated} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HelpdeskDashboard onLogout={handleLogout} />} />
        {/* Anda bisa menambahkan rute lain yang terproteksi di sini */}
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
