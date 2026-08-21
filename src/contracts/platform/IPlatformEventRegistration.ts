import { PlatformEventKey } from './PlatformEventKey';
import { RegistrationTimestamp } from '@/utility/date';

export interface IPlatformEventRegistration {
  registrationId: string;
  eventKey: PlatformEventKey;
  owner: string;
  debugLabel?: string;
  registeredAtUtc: RegistrationTimestamp;
}
