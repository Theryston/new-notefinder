import { userAttemptsRoute } from './fake-user-attempts.ts';
import { userProfileRoute } from './fake-user-profile.ts';

/** The reads of a Profile: its banner and its practice history. */
export const userRoutes = [userProfileRoute, userAttemptsRoute];
