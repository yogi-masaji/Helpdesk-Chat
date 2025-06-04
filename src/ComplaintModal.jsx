import React, { useState, useEffect, useCallback } from 'react';

const ComplaintModal = ({ isOpen, onClose, ticketIdChat, ticketDetails, fetchWithAuth, apiBaseUrl, onComplaintSubmitted }) => {
    const initialFormData = {
        reporter_name: '',
        reporter_email: '',
        reporter_phone: '',
        location: '', // Ini akan diisi otomatis
        issue_date: new Date().toISOString().split('T')[0],
        category: 'Network',
        troubleshoot: '',
        priority: 'Medium',
        issue_title: '',
        issue_description: '',
    };

    const [formData, setFormData] = useState(initialFormData);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [troubleshootOptions, setTroubleshootOptions] = useState([]);

    const categoryTroubleshootMap = {
        'Network': ['Miktrotik', 'Maipu', 'SFP', 'Patchcord', 'HUB', 'Local Network', 'Internet'],
        'IT Support': ['Software Ezitama', 'Software Parkee', 'CPU', 'CPU FAN', 'RAM', 'NVME_HDD', 'Motherboard', 'Booster', 'Printer Thermal', 'Monitor', 'Speaker', 'Amplifier', 'Intercom', 'NVR', 'Camera', 'Printer Office', 'HDMI', 'PCIE', 'VGA Card', 'LAN Card'],
        'IOT_Development': ['Dashboard Income', 'IOT System', 'Dashboard', 'LPR Alfabeta'],
        'Alfabeta': ['Konfigurasi Kamera', 'Konfigurasi NUC'],
        'Infra': ['Power Listrik', 'Kabel LAN', 'Kabel FO', 'Kabel Loop', 'Boomgate', 'VLD'],
        'Parkee System': ['Parkee Agent', 'Parkee Mobile Cashier', 'Network Issue'],
    };

    const updateTroubleshootOptions = useCallback((selectedCategory) => {
        const options = categoryTroubleshootMap[selectedCategory] || [];
        setTroubleshootOptions(options);
        setFormData(prev => ({
            ...prev,
            troubleshoot: options.length > 0 ? options[0] : '', 
        }));
    }, []); 

    useEffect(() => {
        if (isOpen && ticketDetails) {
            // Mengisi otomatis Nama Lokasi dari ticketDetails.location_name jika ada,
            // fallback ke ticketDetails.location_code jika location_name tidak ada.
            const locationToSet = ticketDetails.location_name || ticketDetails.location_code || '';

            setFormData(prev => ({
                ...prev, 
                reporter_name: ticketDetails.user || '',
                reporter_phone: ticketDetails.email ? ticketDetails.email.split('@')[0] : '',
                reporter_email: '', 
                location: locationToSet, // Mengisi otomatis field location
                issue_title: `Komplain terkait tiket: ${ticketIdChat}`, 
                issue_description: '',
                category: prev.category || initialFormData.category, 
            }));
            updateTroubleshootOptions(formData.category || initialFormData.category);
        }
        if (!isOpen) {
            setFormData(initialFormData);
            setSelectedFile(null);
            setError(null);
            setSuccessMessage(null);
            setIsLoading(false);
            updateTroubleshootOptions(initialFormData.category);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, ticketDetails, ticketIdChat, updateTroubleshootOptions]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'category') {
            updateTroubleshootOptions(value);
        }
    };

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        const data = new FormData();
        data.append('id_ticket_chat', ticketIdChat);
        for (const key in formData) {
            data.append(key, formData[key]);
        }
        if (selectedFile) {
            data.append('file', selectedFile);
        }

        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/complaints`, {
                method: 'POST',
                body: data, 
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal membuat komplain (status: ${response.status})`);
            }

            setSuccessMessage(`Komplain berhasil dibuat dengan ID: ${result.complaintTicketId}`);
            
            if (onComplaintSubmitted) {
                onComplaintSubmitted({ 
                    complaintTicketId: result.complaintTicketId, 
                    category: formData.category, 
                    originalTicketIdChat: ticketIdChat 
                });
            }
        } catch (err) {
            console.error("Error submitting complaint:", err);
            setError(err.message || "Terjadi kesalahan saat mengirim komplain.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 overflow-y-auto">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-slate-800">Buat Komplain Baru untuk Tiket: {ticketIdChat}</h3>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-slate-500 hover:text-slate-700 text-2xl"
                        aria-label="Tutup modal"
                    >
                        &times;
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">
                        {error}
                    </div>
                )}
                {successMessage && !error && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm">
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 flex-grow">
                    {/* Row 1: Reporter Name, Email, Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="reporter_name" className="block text-sm font-medium text-slate-700">Nama Pelapor <span className="text-red-500">*</span></label>
                            <input type="text" name="reporter_name" id="reporter_name" value={formData.reporter_name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="reporter_email" className="block text-sm font-medium text-slate-700">Email Pelapor</label>
                            <input type="email" name="reporter_email" id="reporter_email" value={formData.reporter_email} onChange={handleChange} placeholder="Kosongkan jika tidak ada" className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="reporter_phone" className="block text-sm font-medium text-slate-700">Telepon <span className="text-red-500">*</span></label>
                            <input type="text" name="reporter_phone" id="reporter_phone" value={formData.reporter_phone} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>

                    {/* Row 2: Location, Issue Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-slate-700">Nama Lokasi <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                name="location" 
                                id="location" 
                                value={formData.location} // Value diambil dari state
                                onChange={handleChange} 
                                required 
                                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                                placeholder="Nama lokasi dari tiket"
                            />
                        </div>
                        <div>
                            <label htmlFor="issue_date" className="block text-sm font-medium text-slate-700">Tanggal Kejadian <span className="text-red-500">*</span></label>
                            <input type="date" name="issue_date" id="issue_date" value={formData.issue_date} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>
                    
                    {/* Row 3: Division (Category), Troubleshoot Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-slate-700">Divisi <span className="text-red-500">*</span></label>
                            <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                {Object.keys(categoryTroubleshootMap).map(cat => (
                                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="troubleshoot" className="block text-sm font-medium text-slate-700">Kategori Troubleshoot <span className="text-red-500">*</span></label>
                            <select name="troubleshoot" id="troubleshoot" value={formData.troubleshoot} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" disabled={troubleshootOptions.length === 0}>
                                {troubleshootOptions.length === 0 && <option value="">Pilih Divisi terlebih dahulu</option>}
                                {troubleshootOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 4: Priority, Issue Title */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Prioritas <span className="text-red-500">*</span></label>
                            <select name="priority" id="priority" value={formData.priority} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="High">High - 2 Hari</option>
                                <option value="Medium">Medium - 4 Hari</option>
                                <option value="Low">Low - 6 Hari</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="issue_title" className="block text-sm font-medium text-slate-700">Judul Masalah <span className="text-red-500">*</span></label>
                            <input type="text" name="issue_title" id="issue_title" value={formData.issue_title} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>
                    
                    {/* Row 5: Issue Description */}
                    <div>
                        <label htmlFor="issue_description" className="block text-sm font-medium text-slate-700">Deskripsi Masalah <span className="text-red-500">*</span></label>
                        <textarea name="issue_description" id="issue_description" value={formData.issue_description} onChange={handleChange} rows="3" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                    </div>

                    {/* Row 6: File Upload */}
                    <div>
                        <label htmlFor="file" className="block text-sm font-medium text-slate-700">Upload File Pendukung</label>
                        <input type="file" name="file" id="file" onChange={handleFileChange} className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt" />
                        {selectedFile && <p className="text-xs text-slate-500 mt-1">File terpilih: {selectedFile.name}</p>}
                    </div>
                    
                    <div className="pt-2 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors duration-150 disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-150 disabled:opacity-50 disabled:bg-indigo-300"
                        >
                            {isLoading ? "Mengirim..." : "Kirim Komplain"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ComplaintModal;
