import { PlatformEventKey } from './PlatformEventKey';

export interface IPlatformEventRegistration {
  registrationId: string;
  eventKey: PlatformEventKey;
  owner: string;
  debugLabel?: string;
  registeredAtUtc: string;
}
