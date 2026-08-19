import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Template } from '../types';
import { mockTemplates } from '../data/templates';
import { generateId } from '../utils/ids';

interface TemplateState {
  templates: Template[];
  addTemplate: (input: Omit<Template, 'id'>) => Template;
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: mockTemplates,
      addTemplate: (input) => {
        const template: Template = { id: generateId(), ...input };
        set((state) => ({ templates: [template, ...state.templates] }));
        return template;
      },
      updateTemplate: (id, patch) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'speropay/templates', storage: createJSONStorage(() => AsyncStorage) }
  )
);
