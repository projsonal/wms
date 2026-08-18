'use client';

import { useEffect } from 'react';

export function ImageProtection(): null {
  useEffect(() => {
    function isImageTarget(target: EventTarget | null): target is HTMLImageElement {
      return target instanceof HTMLImageElement;
    }

    function blockContextMenu(event: MouseEvent): void {
      if (isImageTarget(event.target)) {
        event.preventDefault();
      }
    }

    function blockDragStart(event: DragEvent): void {
      if (isImageTarget(event.target)) {
        event.stopPropagation();
      }
    }

    function blockDoubleClick(event: MouseEvent): void {
      if (isImageTarget(event.target)) {
        event.stopImmediatePropagation();
      }
    }

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('dragstart', blockDragStart);
    document.addEventListener('dblclick', blockDoubleClick);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('dragstart', blockDragStart);
      document.removeEventListener('dblclick', blockDoubleClick);
    };
  }, []);

  return null;
}
