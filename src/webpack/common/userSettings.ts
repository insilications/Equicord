/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findLazy, find } from "@webpack";

export const UserSettingsActionCreators = {
    FrecencyUserSettingsActionCreators: findLazy(m => m.ProtoClass?.typeName?.endsWith(".FrecencyUserSettings")),
    PreloadedUserSettingsActionCreators: findLazy(m => m.ProtoClass?.typeName?.endsWith(".PreloadedUserSettings")),
    // FavoriteChannelActionCreators: findLazy(m => m.typeName?.endsWith(".FavoriteChannel")),
    FavoriteChannelActionCreators: findLazy(m => m.typeName?.endsWith(".FavoriteChannel")),
    // FavoriteChannelActionCreators: findLazy(m => m.ProtoClass?.typeName?.endsWith(".FavoriteChannel")),
};
