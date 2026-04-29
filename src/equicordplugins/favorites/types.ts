/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel, Guild } from "@vencord/discord-types";

export interface ChannelContextProps {
    channel: Channel,
    config: { context: string; };
    context: string,
    guild: Guild,
    onHeightUpdate: Function,
    position: string,
    target: HTMLElement,
    theme: string,
}

export interface UserSettingsProtoUpdateEvent {
    type: "USER_SETTINGS_PROTO_UPDATE";
    settings: { proto: Record<string, unknown>; type: number; };
    local: boolean;
    partial: boolean;
}

export interface UserSettingsProtoUpdateEditInfoEventSettingsChanges {
    errorCallbacks?: Array<Function>;
    protoToSave?: Record<string, unknown>;
    timeout?: number;
    timeoutDelay?: number;
}

export interface UserSettingsProtoUpdateEditInfoEvent {
    type: "USER_SETTINGS_PROTO_UPDATE_EDIT_INFO";
    settings: { changes: UserSettingsProtoUpdateEditInfoEventSettingsChanges; type: number; };
}
