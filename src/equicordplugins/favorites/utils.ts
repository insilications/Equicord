/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Favorites } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";

export function isFavorite(value: unknown): value is Favorites {
    // return typeof value === "object" && value !== null && !Array.isArray(value) && "favoriteChannels" in value && "muted" in value;
    // return typeof value === "object" && value !== null && "favoriteChannels" in value && typeof value.favoriteChannels === "object";
    return typeof value === "object" && value !== null && typeof (value as any).favoriteChannels === "object";
}

const ChannelTypeNames = {
    [ChannelType.GUILD_TEXT]: "GUILD_TEXT",
    [ChannelType.DM]: "DM",
    [ChannelType.GUILD_VOICE]: "GUILD_VOICE", [ChannelType.GROUP_DM]: "GROUP_DM",
    [ChannelType.GUILD_CATEGORY]: "GUILD_CATEGORY",
    [ChannelType.GUILD_ANNOUNCEMENT]: "GUILD_ANNOUNCEMENT",
    [ChannelType.GUILD_STORE]: "GUILD_STORE", [ChannelType.ANNOUNCEMENT_THREAD]: "ANNOUNCEMENT_THREAD",
    [ChannelType.PUBLIC_THREAD]: "PUBLIC_THREAD",
    [ChannelType.PRIVATE_THREAD]: "PRIVATE_THREAD", [ChannelType.GUILD_STAGE_VOICE]: "GUILD_STAGE_VOICE", [ChannelType.GUILD_DIRECTORY]: "GUILD_DIRECTORY",
    [ChannelType.GUILD_FORUM]: "GUILD_FORUM",
    [ChannelType.GUILD_MEDIA]: "GUILD_MEDIA",
    [ChannelType.LOBBY]: "LOBBY",
    [ChannelType.DM_SDK]: "DM_SDK",
    [ChannelType.UNKNOWN]: "UNKNOWN",
} satisfies Record<ChannelType, string>;

export function getChannelTypeName(type: ChannelType): string {
    return ChannelTypeNames[type] ?? `UNMAPPED_TYPE_${type}`;
}

// function findGetterDeep(obj: any, visited: Set<any>): any {
//     // Fast fail for primitives and null
//     if (typeof obj !== "object" || obj === null) {
//         return typeof obj === "function" ? obj : undefined;
//     }

//     if (visited.has(obj)) return undefined;
//     visited.add(obj);

//     if (Array.isArray(obj)) {
//         for (let i = 0; i < obj.length; i++) {
//             const found = findGetterDeep(obj[i], visited);
//             if (found !== undefined) return found;
//         }
//         return undefined;
//     }

//     for (const key in obj) {
//         // REQUIRED SAFETY CHECK:
//         // 1. Prototype Filtering: for...in iterates over inherited properties as well.
//         //    This check ensures we only look at the object's own properties, preventing
//         //    us from accidentally finding and returning inherited prototype methods.
//         // 2. Safe Invocation: We use `Object.prototype.hasOwnProperty.call(obj, key)`
//         //    instead of `obj.hasOwnProperty(key)` because:
//         //      a) Objects created via `Object.create(null)` don't have a .hasOwnProperty method (would crash).
//         //      b) Malicious or dynamic objects might have a property literally named "hasOwnProperty".
//         if (Object.prototype.hasOwnProperty.call(obj, key)) {
//             const found = findGetterDeep(obj[key], visited);
//             if (found !== undefined) return found;
//         }
//     }

//     return undefined;
// }

// export function searchProtoClassField2(localName: string, protoClass: any): any {
//     const fields: any = protoClass?.fields;
//     if (!fields || !Array.isArray(fields)) return undefined;

//     let targetField: any;
//     for (let i: number = 0; i < fields.length; i++) {
//         if (fields[i].localName === localName) {
//             targetField = fields[i];
//             break; // Stop immediately once found
//         }
//     }

//     if (!targetField) return undefined;

//     const fieldGetter: any = findGetterDeep(targetField, new Set());
//     return fieldGetter?.();
// }

function parseFieldInfo(field: any): any {
    if (typeof field === "function") {
        field = field();
    }

    switch (field.kind) {
        case "message":
            return field?.T();
        case "map":
            return parseFieldInfo(field.V);
        default:
            return;
    }
}

export function searchProtoClassField(localName: string, protoClass: any): any {
    const field: any = protoClass?.fields?.find((field: any) => field.localName === localName);
    if (!field) return;

    return parseFieldInfo(field);
}
