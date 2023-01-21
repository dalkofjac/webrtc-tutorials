import { identifierName } from "@angular/compiler"
import { WebRTCClientType } from "./webrtc-client";

export class HubClient {
  id: string;
  type: WebRTCClientType;
}