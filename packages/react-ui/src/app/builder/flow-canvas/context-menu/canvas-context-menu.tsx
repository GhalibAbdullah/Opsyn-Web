import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ShortcutProps } from '@/components/ui/shortcut';
import { useContext } from 'react';

import { BuilderStateContext } from '../../builder-hooks';
import { CanvasContextMenuContent } from './canvas-context-menu-content';

export type CanvasShortcutsProps = Record<
  'Paste' | 'Delete' | 'Copy' | 'Skip',
  ShortcutProps
>;
export const CanvasShortcuts: CanvasShortcutsProps = {
  Paste: {
    withCtrl: true,
    withShift: false,
    shortcutKey: 'v',
  },
  Delete: {
    withCtrl: false,
    withShift: true,
    shortcutKey: 'Delete',
  },
  Copy: {
    withCtrl: true,
    withShift: false,
    shortcutKey: 'c',
    shouldNotPreventDefault: true,
  },
  Skip: {
    withCtrl: true,
    withShift: false,
    shortcutKey: 'e',
  },
};
export enum ContextMenuType {
  CANVAS = 'CANVAS',
  STEP = 'STEP',
}
export type CanvasContextMenuProps = {
  children?: React.ReactNode;
  contextMenuType: ContextMenuType;
};
export const CanvasContextMenu = ({
  contextMenuType,
  children,
}: CanvasContextMenuProps) => {
  // Check if context is available before using it
  // This prevents errors during navigation or when the provider isn't ready yet
  const context = useContext(BuilderStateContext);
  
  // If context is not available, render children without context menu
  // This can happen during navigation transitions or when pieces are disabled
  if (!context) {
    return <>{children}</>;
  }
  
  // Use the store directly from context to get readonly state
  // This avoids calling useBuilderStateContext which throws if context is missing
  const readonly = context.getState().readonly;
  
  if (readonly) {
    return <>{children}</>;
  }
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <CanvasContextMenuContent
          contextMenuType={contextMenuType}
        ></CanvasContextMenuContent>
      </ContextMenuContent>
    </ContextMenu>
  );
};
