import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen, onClose, onConfirm, title, message,
  confirmText = 'تأكيد', cancelText = 'إلغاء',
  isDestructive = false, isLoading = false
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={isDestructive ? 'btn-danger' : 'btn-primary'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : null}
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDestructive ? 'bg-red-100' : 'bg-coffee-100'}`}>
          <AlertTriangle className={`w-5 h-5 ${isDestructive ? 'text-red-600' : 'text-coffee-600'}`} />
        </div>
        <p className="text-stone-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
