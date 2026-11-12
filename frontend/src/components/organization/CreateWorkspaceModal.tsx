import React, { useState } from 'react';
import { X, Building2, User, Loader2 } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import type { OrganizationType } from '@/types';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ isOpen, onClose }) => {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('COMPANY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createOrganization({
        name: name.trim(),
        type,
      });
      setName('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-dark-100">Create New Workspace</h3>
              <p className="text-xs text-dark-400">Set up an isolated multi-tenant organization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-600 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-200 mb-1.5">
              Workspace Type
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setType('COMPANY')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                  type === 'COMPANY'
                    ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-xs'
                    : 'border-slate-200 text-dark-300 hover:bg-slate-50'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-bold">Company</div>
                  <div className="text-[10px] text-dark-400">Team collaboration</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('PERSONAL')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                  type === 'PERSONAL'
                    ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-xs'
                    : 'border-slate-200 text-dark-300 hover:bg-slate-50'
                }`}
              >
                <User className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-bold">Personal</div>
                  <div className="text-[10px] text-dark-400">Individual use</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-200 mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'COMPANY' ? 'Acme Corp, Cyberdyne...' : 'My Workspace'}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-dark-100 placeholder-dark-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-dark-300 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md shadow-purple-500/25"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
