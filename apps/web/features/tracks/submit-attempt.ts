import type { SubmitPracticeAttemptBody } from '@notefinder/contracts';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { submitPracticeAttempt } from './attempt-queries';
import { trackKeys } from './query-keys';
import { type RequestErrorMessage, requestErrorMessage } from './request-error';

/**
 * The mutation behind saving a run: submit it, then read the Track state
 * again so the best score shows at once. A refusal (the run the page sent is
 * not valid anymore) toasts the API's error code. Kept out of the hook so
 * the wiring stays testable without rendering.
 */
export function submitAttemptMutation(
  queryClient: QueryClient,
  trackId: string,
  translate: (message: RequestErrorMessage) => string,
) {
  return {
    mutationFn: (body: SubmitPracticeAttemptBody) =>
      submitPracticeAttempt(trackId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trackKeys.userState(trackId),
      });
    },
    onError: (error: unknown) => {
      toast.error(translate(requestErrorMessage(error)));
    },
  };
}
