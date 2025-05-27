// ConfirmationModal.js
import React from 'react';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300">
      <div className="bg-white p-6 rounded-lg shadow-xl transform transition-all duration-300 scale-100 w-full max-w-md">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 ${
              title.toLowerCase().includes('tutup') ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400' : 'bg-green-500 hover:bg-green-600 focus:ring-green-400'
            }`}
          >
            {isLoading ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;