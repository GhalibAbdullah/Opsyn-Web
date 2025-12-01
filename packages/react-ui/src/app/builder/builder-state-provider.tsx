import { useEffect, useRef } from 'react';

import {
  BuilderInitialState,
  BuilderStateContext,
  BuilderStore,
  createBuilderStore,
} from '@/app/builder/builder-hooks';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { projectHooks } from '@/hooks/project-hooks';
import { Permission } from '@activepieces/shared';

type BuilderStateProviderProps = React.PropsWithChildren<BuilderInitialState>;

export function BuilderStateProvider({
  children,
  outputSampleData: sampleData,
  inputSampleData: sampleDataInput,
  ...props
}: BuilderStateProviderProps) {
  const storeRef = useRef<BuilderStore>();
  const { checkAccess } = useAuthorization();
  const readonly = !checkAccess(Permission.WRITE_FLOW) || props.readonly;
  projectHooks.useReloadPageIfProjectIdChanged(props.flow.projectId);
  if (!storeRef.current) {
    storeRef.current = createBuilderStore({
      ...props,
      readonly,
      outputSampleData: sampleData,
      inputSampleData: sampleDataInput,
    });
  }

  // Update readonly state when permissions change
  useEffect(() => {
    if (storeRef.current) {
      const state = storeRef.current.getState();
      // Update permission-based readonly
      // Use setReadOnly which will properly handle permissionBasedReadonly
      state.setReadOnly(readonly);
    }
  }, [readonly]);

  return (
    <BuilderStateContext.Provider value={storeRef.current}>
      {children}
    </BuilderStateContext.Provider>
  );
}
