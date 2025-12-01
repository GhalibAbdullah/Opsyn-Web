import React, { useEffect, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { PiecesSearchInput } from '@/features/pieces/components/piece-selector-search';
import { PieceSelectorTabs } from '@/features/pieces/components/piece-selector-tabs';
import {
  PieceSelectorTabsProvider,
  PieceSelectorTabType,
} from '@/features/pieces/lib/piece-selector-tabs-provider';
import { pieceSelectorUtils } from '@/features/pieces/lib/piece-selector-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { PieceSelectorOperation } from '@/lib/types';
import { FlowOperationType, FlowTriggerType } from '@activepieces/shared';

import { ExploreTabContent } from './explore-tab-content';
import { PiecesCardList } from './pieces-card-list';

type PieceSelectorProps = {
  children: React.ReactNode;
  id: string;
  operation: PieceSelectorOperation;
  openSelectorOnClick?: boolean;
  stepToReplacePieceDisplayName?: string;
};

const PieceSelector = ({
  children,
  operation,
  id,
  openSelectorOnClick = true,
  stepToReplacePieceDisplayName,
}: PieceSelectorProps) => {
  const [
    openedPieceSelectorStepNameOrAddButtonId,
    setOpenedPieceSelectorStepNameOrAddButtonId,
    setSelectedPieceMetadataInPieceSelector,
    isForEmptyTrigger,
    deselectStep,
    readonly,
  ] = useBuilderStateContext((state) => [
    state.openedPieceSelectorStepNameOrAddButtonId,
    state.setOpenedPieceSelectorStepNameOrAddButtonId,
    state.setSelectedPieceMetadataInPieceSelector,
    state.flowVersion.trigger.type === FlowTriggerType.EMPTY &&
      id === 'trigger',
    state.deselectStep,
    state.readonly,
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const isForReplace =
    operation.type === FlowOperationType.UPDATE_ACTION ||
    (operation.type === FlowOperationType.UPDATE_TRIGGER && !isForEmptyTrigger);
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const isOpen = openedPieceSelectorStepNameOrAddButtonId === id;
  const isMobile = useIsMobile();
  const { listHeightRef, popoverTriggerRef } =
    pieceSelectorUtils.useAdjustPieceListHeightToAvailableSpace();
  const listHeight = Math.min(listHeightRef.current, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedPieceMetadataInPieceSelector(null);
  };
  return (
    <Popover
      open={isOpen && !readonly}
      modal={true}
      onOpenChange={(open) => {
        if (readonly) {
          return; // Don't allow opening if readonly
        }
        if (!open) {
          clearSearch();
          setOpenedPieceSelectorStepNameOrAddButtonId(null);
          if (isForEmptyTrigger) {
            deselectStep();
          }
        }
      }}
    >
      <PopoverTrigger
        ref={popoverTriggerRef}
        asChild={true}
        disabled={readonly}
        onClick={(e) => {
          if (readonly) {
            e.preventDefault();
            e.stopPropagation();
            return; // Don't open if readonly
          }
          if (openSelectorOnClick) {
            setOpenedPieceSelectorStepNameOrAddButtonId(id);
          }
        }}
      >
        <div
          style={readonly ? { pointerEvents: 'none', cursor: 'not-allowed', opacity: 0.5 } : undefined}
          onClick={(e) => {
            if (readonly) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {children}
        </div>
      </PopoverTrigger>

      <PieceSelectorTabsProvider
        initiallySelectedTab={
          isForReplace || isMobile
            ? PieceSelectorTabType.NONE
            : PieceSelectorTabType.EXPLORE
        }
        onTabChange={clearSearch}
        key={isOpen ? 'open' : 'closed'}
      >
        <PopoverContent
          onContextMenu={(e) => {
            e.stopPropagation();
          }}
          className="w-[340px] md:w-[600px] p-0 shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <>
            <div>
              <PiecesSearchInput
                searchQuery={searchQuery}
                searchInputRef={searchInputRef}
                onSearchChange={(e) => {
                  setSearchQuery(e);
                  setSelectedPieceMetadataInPieceSelector(null);
                  if (e === '') {
                    clearSearch();
                  }
                }}
              />
              {!isMobile && <PieceSelectorTabs />}
              <Separator orientation="horizontal" className="mt-1" />
            </div>
            <div
              className=" flex flex-row max-h-[300px]"
              style={{
                height: listHeight + 'px',
              }}
            >
              <ExploreTabContent operation={operation} />
              <PiecesCardList
                //this is done to avoid debounced results when user clears search
                searchQuery={searchQuery === '' ? '' : debouncedQuery}
                operation={operation}
                stepToReplacePieceDisplayName={
                  isMobile ? undefined : stepToReplacePieceDisplayName
                }
              />
            </div>
          </>
        </PopoverContent>
      </PieceSelectorTabsProvider>
    </Popover>
  );
};

export { PieceSelector };
