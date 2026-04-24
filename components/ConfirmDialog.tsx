import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen, onClose, onConfirm, title, body,
  confirmLabel = 'Confirmar',
  variant = 'danger',
  loading = false,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    icon={variant === 'danger' ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
    iconColor={variant === 'danger' ? 'danger' : 'info'}
    actions={[
      { label: 'Cancelar', onClick: onClose, variant: 'secondary' },
      { label: confirmLabel, onClick: onConfirm, variant, loading },
    ]}
  >
    {body ? (
      <p className="text-sm text-slate-600 text-center">{body}</p>
    ) : null}
  </Modal>
);
