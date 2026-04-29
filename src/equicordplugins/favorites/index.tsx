/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 nin0dev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, addGlobalContextMenuPatch, findGroupChildrenByChildId, GlobalContextMenuPatchCallback, NavContextMenuPatchCallback, removeGlobalContextMenuPatch } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { FavoriteIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { StartAt } from "@utils/types";
import { Channel, type FavoriteChannel, type FavoriteChannels, type Favorites, type Guild } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy, proxyLazyWebpack } from "@webpack";
import {
    ChannelStore,
    FluxDispatcher,
    GuildStore,
    Menu,
    Toasts,
    UserSettingsActionCreators,
    UserSettingsProtoStore
} from "@webpack/common";
import type { ReactElement } from "react";

import type { ChannelContextProps, UserSettingsProtoUpdateEditInfoEvent, UserSettingsProtoUpdateEvent } from "./types";
import { getChannelTypeName, isFavorite, searchProtoClassField } from "./utils";

const FavoritesLogger = new Logger("Favorites");
let FavoritesCache: Favorites = Object.create(null);

const FAVORITES_DATA_KEY = "FavoritesData";
const BINARY_READ_OPTIONS: any = findByPropsLazy("readerFactory");
const PreloadedUserSettingsActionCreators: any = proxyLazyWebpack(() => UserSettingsActionCreators.PreloadedUserSettingsActionCreators);
const FavoritesSettingsActionCreators: any = proxyLazyWebpack(() => searchProtoClassField("favorites", PreloadedUserSettingsActionCreators.ProtoClass));
// const FavoritesSettingsActionCreators: any = proxyLazyWebpack(() => searchProtoClassField("favorites", PreloadedUserSettingsActionCreators.ProtoClass));
const FavoriteChannelActionCreators: any = proxyLazyWebpack(() => searchProtoClassField("favoriteChannels", FavoritesSettingsActionCreators));
// const FavoriteChannelActionCreators: any = proxyLazyWebpack(() => searchProtoClassField("favoriteChannels", FavoritesSettingsActionCreators));

export function updateFavoritesCache(favoriteChannels: FavoriteChannels, muted: boolean): void {
    const newFavorites: Favorites = Object.create(null);
    const newFavoriteChannels: FavoriteChannels = Object.create(null);

    const favoriteChannelIds: string[] = Object.keys(favoriteChannels);
    for (let i = 0, favoriteChannelIdsLen = favoriteChannelIds.length; i < favoriteChannelIdsLen; i++) {
        const key: string = favoriteChannelIds[i]!;
        const value: FavoriteChannel = favoriteChannels[key];
        newFavoriteChannels[key] = value;
    }
    newFavorites.favoriteChannels = newFavoriteChannels;
    newFavorites.muted = muted;

    FavoritesCache = newFavorites;
}

export const settings = definePluginSettings({}).withPrivateSettings<{
    favorites: Favorites | undefined;
    firstRun: boolean | undefined;
}>();

async function addToFavorites(channel: Channel): Promise<void> {
    try {
        if (!channel) {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        const channelId: string = channel.id;
        FavoritesLogger.log("addToFavorites - channel: ", channel);

        const guildId: string = channel.guild_id;
        if (!guildId) {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        FavoritesLogger.log("addToFavorites - guildId: ", guildId);

        if (PreloadedUserSettingsActionCreators == null || FavoritesSettingsActionCreators == null || FavoriteChannelActionCreators == null || !BINARY_READ_OPTIONS) {
            FavoritesLogger.error("addToFavorites - PreloadedUserSettingsActionCreators: ", PreloadedUserSettingsActionCreators);
            FavoritesLogger.error("addToFavorites - FavoritesSettingsActionCreators: ", FavoritesSettingsActionCreators);
            FavoritesLogger.error("addToFavorites - FavoriteChannelActionCreators: ", FavoriteChannelActionCreators);
            FavoritesLogger.error("addToFavorites - BINARY_READ_OPTIONS: ", BINARY_READ_OPTIONS);
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Failed to add to favorites.",
                id: Toasts.genId(),
            });
            return;
        }

        const preloadedUserSettingsFavorites: Favorites = await DataStore.get<Favorites>(FAVORITES_DATA_KEY) ?? { favoriteChannels: {}, muted: false };
        FavoritesLogger.log(
            "addToFavorites - preloadedUserSettingsFavorites: ",
            preloadedUserSettingsFavorites,
        );

        const sortedChannels: (FavoriteChannel & { id: string; })[] = [];
        const currentFavoriteChannels: Record<string, FavoriteChannel> = preloadedUserSettingsFavorites.favoriteChannels;
        const channelIdsKeys: string[] = Object.keys(currentFavoriteChannels);
        for (let i = 0, channelIdsKeysLen = channelIdsKeys.length; i < channelIdsKeysLen; i++) {
            const id: string = channelIdsKeys[i];

            const ch: Channel | undefined = ChannelStore.getChannel(id);
            const favChannel: FavoriteChannel = currentFavoriteChannels[id];

            if (ch) {
                const logs: string[] = [`addToFavorites - ${favChannel.position} - channel.id ${id} - channel.name: ${ch.name} - channel.type: ${getChannelTypeName(ch.type)}`];

                if (ch.type !== ChannelType.DM) {
                    const guild: Guild = GuildStore.getGuild(ch.guild_id);
                    logs.push(` guild.id: ${guild.id} - guild.name: ${guild.name}`);
                } else {
                    // logs.push("Direct Message channel");
                }

                sortedChannels.push({ id, ...favChannel });
                FavoritesLogger.log(logs.join(), ch);
            } else {
                FavoritesLogger.warn(`addToFavorites - ${favChannel.position} - channel.id ${id} not found in ChannelStore`);
            }
        }

        sortedChannels.sort((a, b) => a.position - b.position);
        // Re-index sequentially to eliminate gaps.
        for (let i: number = 0, sortedChannelsLen: number = sortedChannels.length; i < sortedChannelsLen; i++) {
            sortedChannels[i].position = i;
        }

        // Add the new favorite channel at the end of the list with the next available position
        sortedChannels.push({ id: channelId, nickname: "", type: 1, position: sortedChannels.length + 1, parentId: guildId });

        FavoritesLogger.log(
            "addToFavorites - sortedChannels: ",
            sortedChannels,
        );

        const favoritesSettingsProto: Favorites = FavoritesSettingsActionCreators.create();
        for (let i: number = 0, sortedChannelsLen: number = sortedChannels.length; i < sortedChannelsLen; i++) {
            const channel: FavoriteChannel & { id: string; } = sortedChannels[i];
            const newFavChannel: FavoriteChannel = FavoriteChannelActionCreators.create({
                nickname: channel.nickname,
                type: channel.type,
                position: channel.position,
                parentId: channel.parentId,
            });
            favoritesSettingsProto.favoriteChannels[channel.id] = newFavChannel;
        }
        // FavoritesLogger.log(
        //     "addToFavorites - favoritesSettingsProto: ",
        //     favoritesSettingsProto,
        // );

        const settingsProto: any = PreloadedUserSettingsActionCreators.ProtoClass.create();
        settingsProto.favorites = favoritesSettingsProto;
        FavoritesLogger.log(
            "addToFavorites - settingsProto: ",
            settingsProto,
        );

        await FluxDispatcher.dispatch({
            type: "USER_SETTINGS_PROTO_UPDATE",
            local: true,
            partial: true,
            settings: {
                type: 1,
                proto: settingsProto,
            },
        });

        // await DataStore.set(FAVORITES_DATA_KEY, { favoriteChannels: favoritesSettingsProto.favoriteChannels, muted: preloadedUserSettingsFavorites.muted });
        // updateFavoritesCache(favoritesSettingsProto.favoriteChannels, preloadedUserSettingsFavorites.muted);
    } catch (err) {
        FavoritesLogger.error("addToFavorites - error: ", err);
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "Failed to add channel to favorites.",
            id: Toasts.genId(),
        });
    }
}

async function removeFromFavorites(channel: Channel): Promise<void> {
    try {
        if (!channel) {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        const channelId: string = channel.id;
        FavoritesLogger.log("removeFromFavorites - channel: ", channel);

        const guildId: string = channel.guild_id;
        if (!guildId) {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        FavoritesLogger.log("removeFromFavorites -guildId: ", guildId);

        if (PreloadedUserSettingsActionCreators == null || FavoritesSettingsActionCreators == null || FavoriteChannelActionCreators == null || !BINARY_READ_OPTIONS) {
            FavoritesLogger.error("removeFromFavorites - PreloadedUserSettingsActionCreators: ", PreloadedUserSettingsActionCreators);
            FavoritesLogger.error("removeFromFavorites - FavoritesSettingsActionCreators: ", FavoritesSettingsActionCreators);
            FavoritesLogger.error("removeFromFavorites - FavoriteChannelActionCreators: ", FavoriteChannelActionCreators);
            FavoritesLogger.error("removeFromFavorites - BINARY_READ_OPTIONS: ", BINARY_READ_OPTIONS);
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Failed to remove from favorites.",
                id: Toasts.genId(),
            });
            return;
        }

        const preloadedUserSettingsFavorites: Favorites = await DataStore.get<Favorites>(FAVORITES_DATA_KEY) ?? { favoriteChannels: {}, muted: false };
        FavoritesLogger.log(
            "removeFromFavorites - preloadedUserSettingsFavorites: ",
            preloadedUserSettingsFavorites,
        );

        const sortedChannels: (FavoriteChannel & { id: string; })[] = [];
        const currentFavoriteChannels: Record<string, FavoriteChannel> = preloadedUserSettingsFavorites.favoriteChannels;
        const channelIdsKeys: string[] = Object.keys(currentFavoriteChannels);
        for (let i = 0, channelIdsKeysLen = channelIdsKeys.length; i < channelIdsKeysLen; i++) {
            const id: string = channelIdsKeys[i];

            const ch: Channel | undefined = ChannelStore.getChannel(id);
            const favChannel: FavoriteChannel = currentFavoriteChannels[id];

            if (ch && id !== channelId) {
                const logs: string[] = [`removeFromFavorites - ${favChannel.position} - channel.id ${id} - channel.name: ${ch.name} - channel.type: ${getChannelTypeName(ch.type)}`];

                if (ch.type !== ChannelType.DM) {
                    const guild: Guild = GuildStore.getGuild(ch.guild_id);
                    logs.push(` guild.id: ${guild.id} - guild.name: ${guild.name}`);
                } else {
                    // logs.push("Direct Message channel");
                }

                sortedChannels.push({ id, ...favChannel });
                FavoritesLogger.log(logs.join(), ch);
            } else {
                FavoritesLogger.warn(`removeFromFavorites - ${favChannel.position} - channel.id ${id} not found in ChannelStore`);
                FavoritesLogger.warn(`removeFromFavorites - ${favChannel.position} - ch: `, ch);
                FavoritesLogger.warn(`removeFromFavorites - ${favChannel.position} - id: ${id} - channelId: ${channelId}`);
            }
        }

        sortedChannels.sort((a, b) => a.position - b.position);
        // Re-index sequentially to eliminate gaps.
        for (let i: number = 0, sortedChannelsLen: number = sortedChannels.length; i < sortedChannelsLen; i++) {
            sortedChannels[i].position = i;
        }

        FavoritesLogger.log(
            "removeFromFavorites - sortedChannels: ",
            sortedChannels,
        );

        const favoritesSettingsProto: Favorites = FavoritesSettingsActionCreators.create();
        for (let i: number = 0, sortedChannelsLen: number = sortedChannels.length; i < sortedChannelsLen; i++) {
            const channel: FavoriteChannel & { id: string; } = sortedChannels[i];
            const newFavChannel: FavoriteChannel = FavoriteChannelActionCreators.create({
                nickname: channel.nickname,
                type: channel.type,
                position: channel.position,
                parentId: channel.parentId,
            });
            favoritesSettingsProto.favoriteChannels[channel.id] = newFavChannel;
        }
        // FavoritesLogger.log(
        //     "removeFromFavorites - favoritesSettingsProto: ",
        //     favoritesSettingsProto,
        // );

        const settingsProto: any = PreloadedUserSettingsActionCreators.ProtoClass.create();
        settingsProto.favorites = favoritesSettingsProto;
        FavoritesLogger.log(
            "removeFromFavorites - settingsProto: ",
            settingsProto,
        );

        await FluxDispatcher.dispatch({
            type: "USER_SETTINGS_PROTO_UPDATE",
            local: true,
            partial: true,
            settings: {
                type: 1,
                proto: settingsProto,
            },
        });

        // await DataStore.set(FAVORITES_DATA_KEY, { favoriteChannels: favoritesSettingsProto.favoriteChannels, muted: preloadedUserSettingsFavorites.muted });
        // updateFavoritesCache(favoritesSettingsProto.favoriteChannels, preloadedUserSettingsFavorites.muted);
    } catch (err) {
        FavoritesLogger.error("removeFromFavorites - error: ", err);
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "Failed to remove channel from favorites.",
            id: Toasts.genId(),
        });
    }
}

async function refreshFavorites(): Promise<void> {
    try {
        if (PreloadedUserSettingsActionCreators == null || FavoritesSettingsActionCreators == null || FavoriteChannelActionCreators == null || !BINARY_READ_OPTIONS) {
            FavoritesLogger.error("refreshFavorites - PreloadedUserSettingsActionCreators: ", PreloadedUserSettingsActionCreators);
            FavoritesLogger.error("refreshFavorites - FavoritesSettingsActionCreators: ", FavoritesSettingsActionCreators);
            FavoritesLogger.error("refreshFavorites - FavoriteChannelActionCreators: ", FavoriteChannelActionCreators);
            FavoritesLogger.error("refreshFavorites - BINARY_READ_OPTIONS: ", BINARY_READ_OPTIONS);
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Failed to refresh favorites.",
                id: Toasts.genId(),
            });
            return;
        }

        const preloadedUserSettingsFavorites: Favorites =
            settings.store.firstRun === undefined
                ? (UserSettingsProtoStore.settings.favorites ?? { favoriteChannels: {}, muted: false })
                : await DataStore.get<Favorites>(FAVORITES_DATA_KEY) ?? { favoriteChannels: {}, muted: false };
        FavoritesLogger.log(
            "refreshFavorites - preloadedUserSettingsFavorites: ",
            preloadedUserSettingsFavorites,
        );

        const sortedChannels: (FavoriteChannel & { id: string; })[] = [];
        const currentFavoriteChannels: Record<string, FavoriteChannel> = preloadedUserSettingsFavorites.favoriteChannels;
        const channelIdsKeys: string[] = Object.keys(currentFavoriteChannels);
        for (let i = 0, channelIdsKeysLen = channelIdsKeys.length; i < channelIdsKeysLen; i++) {
            const id: string = channelIdsKeys[i];

            const ch: Channel | undefined = ChannelStore.getChannel(id);
            const favChannel: FavoriteChannel = currentFavoriteChannels[id];

            if (ch) {
                const logs: string[] = [`refreshFavorites - ${favChannel.position} - channel.id ${id} - channel.name: ${ch.name} - channel.type: ${getChannelTypeName(ch.type)}`];

                if (ch.type !== ChannelType.DM) {
                    const guild: Guild = GuildStore.getGuild(ch.guild_id);
                    logs.push(` guild.id: ${guild.id} - guild.name: ${guild.name}`);
                } else {
                    // logs.push("Direct Message channel");
                }

                sortedChannels.push({ id, ...favChannel });
                FavoritesLogger.log(logs.join(), ch);
            } else {
                FavoritesLogger.warn(`refreshFavorites - ${favChannel.position} - channel.id ${id} not found in ChannelStore`);
            }
        }

        sortedChannels.sort((a, b) => a.position - b.position);
        // Re-index sequentially to eliminate gaps.
        for (let i: number = 0, sortedChannelsLen: number = sortedChannels.length; i < sortedChannelsLen; i++) {
            sortedChannels[i].position = i;
        }
        FavoritesLogger.log(
            "refreshFavorites - sortedChannels: ",
            sortedChannels,
        );

        const favoritesSettingsProto: Favorites = FavoritesSettingsActionCreators.create();
        for (let i: number = 0, sortedChannelsLen: number = sortedChannels.length; i < sortedChannelsLen; i++) {
            const channel: FavoriteChannel & { id: string; } = sortedChannels[i];
            const newFavChannel: FavoriteChannel = FavoriteChannelActionCreators.create({
                nickname: channel.nickname,
                type: channel.type,
                position: channel.position,
                parentId: channel.parentId,
            });
            favoritesSettingsProto.favoriteChannels[channel.id] = newFavChannel;
        }
        // FavoritesLogger.log(
        //     "refreshFavorites - favoritesSettingsProto: ",
        //     favoritesSettingsProto,
        // );

        const settingsProto: any = PreloadedUserSettingsActionCreators.ProtoClass.create();
        settingsProto.favorites = favoritesSettingsProto;
        FavoritesLogger.log(
            "refreshFavorites - settingsProto: ",
            settingsProto,
        );

        await FluxDispatcher.dispatch({
            type: "USER_SETTINGS_PROTO_UPDATE",
            local: true,
            partial: true,
            settings: {
                type: 1,
                proto: settingsProto,
            },
        });

        if (settings.store.firstRun === undefined) {
            // await DataStore.set(FAVORITES_DATA_KEY, { favoriteChannels: favoritesSettingsProto.favoriteChannels, muted: preloadedUserSettingsFavorites.muted });
            settings.store.firstRun = false;
            FavoritesLogger.log(
                "First run detected, saved sorted channels to DataStore and set firstRun to false.",
            );
        }

        // updateFavoritesCache(favoritesSettingsProto.favoriteChannels, preloadedUserSettingsFavorites.muted);
    } catch (err) {
        FavoritesLogger.error("refreshFavorites - error: ", err);
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "Failed to refresh favorites.",
            id: Toasts.genId(),
        });
    }
}

function createAddToFavoritesMenuItem(channel: Channel): ReactElement {
    return (
        <Menu.MenuItem
            id="add-to-favorites"
            label="Add to Favorites 1"
            iconLeft={FavoriteIcon}
            leadingAccessory={{
                type: "icon",
                icon: FavoriteIcon
            }}
            action={() => addToFavorites(channel)}
        />
    );
}

function createRemoveFromFavoritesMenuItem(channel: Channel): ReactElement {
    return (
        <Menu.MenuItem
            id="remove-from-favorites"
            label="Remove from Favorites 1"
            color="danger"
            action={() => removeFromFavorites(channel)}
        />
    );
}

function favoritesChannelMenuPatch(children: Array<ReactElement<any> | null | undefined>,
    props: ChannelContextProps): void {
    const favoriteGroup: Array<ReactElement<any> | null | undefined> | null = findGroupChildrenByChildId(
        ["favorite-channel"],
        children,
        false
    );

    if (favoriteGroup != null) {
        const idx: number = favoriteGroup.findIndex(c => c?.props?.id === "favorite-channel");
        // FavoritesLogger.log(
        //     "favoriteGroup - idx: ",
        //     idx
        // );
        if (idx !== -1) {
            const { channel } = props;
            // const preloadedUserSettingsFavorites: Favorites = await DataStore.get<Favorites>(FAVORITES_DATA_KEY) ?? { favoriteChannels: {}, muted: false };
            // const preloadedUserSettingsFavorites = DataStore.get<Favorites>(FAVORITES_DATA_KEY).then(favorites => favorites ?? { favoriteChannels: {}, muted: false });

            // FavoritesLogger.log("FavoritesCache: ", FavoritesCache);

            if (FavoritesCache.favoriteChannels[channel.id] === undefined) {
                FavoritesLogger.log(
                    "Channel is not a favorite, adding add menu item.",
                    channel,
                );
                favoriteGroup.splice(idx, 1, createAddToFavoritesMenuItem(channel));
            } else {
                FavoritesLogger.log(
                    "Channel is already a favorite, adding remove menu item.",
                    channel,
                );
                favoriteGroup.splice(idx, 1, createRemoveFromFavoritesMenuItem(channel));
            }
        }
        // FavoritesLogger.log(
        //     "favoriteGroup: ",
        //     favoriteGroup
        // );
    }
    // FavoritesLogger.log(
    //     "children: ",
    //     children
    // );
}

// function favoritesChannelMenuPatch(children: Array<ReactElement<any> | null | undefined>,
//     props: ChannelContextProps): void {
//     const favoriteGroup: Array<ReactElement<any> | null | undefined> | null = findGroupChildrenByChildId(
//         ["favorite-channel"],
//         children,
//         false
//     );

//     if (favoriteGroup != null) {
//         const idx: number = favoriteGroup.findIndex(c => c?.props?.id === "favorite-channel");
//         FavoritesLogger.log(
//             "favoriteGroup - idx: ",
//             idx
//         );
//         if (idx !== -1) {
//             const { channel } = props;
//             // const preloadedUserSettingsFavorites: Favorites = await DataStore.get<Favorites>(FAVORITES_DATA_KEY) ?? { favoriteChannels: {}, muted: false };
//             const preloadedUserSettingsFavorites = DataStore.get<Favorites>(FAVORITES_DATA_KEY).then(favorites => favorites ?? { favoriteChannels: {}, muted: false });

//             if (preloadedUserSettingsFavorites.favoriteChannels[channel.id] === undefined) {
//                 FavoritesLogger.log(
//                     "Channel is not a favorite, adding add menu item.",
//                     channel,
//                 );
//                 favoriteGroup.splice(idx, 1, createAddToFavoritesMenuItem(channel));
//             } else {
//                 FavoritesLogger.log(
//                     "Channel is already a favorite, adding remove menu item.",
//                     channel,
//                 );
//                 favoriteGroup.splice(idx, 1, createRemoveFromFavoritesMenuItem(channel));
//             }
//         }
//         FavoritesLogger.log(
//             "favoriteGroup: ",
//             favoriteGroup
//         );
//     }
// FavoritesLogger.log(
//     "children: ",
//     children
// );
// }

export default definePlugin({
    name: "Favorites",
    description:
        "Manage your favorite channels",
    tags: ["Appearance", "Customisation", "Organisation", "Servers"],
    authors: [Devs.insilications],
    dependencies: ["ContextMenuAPI"],
    settings,
    async start(): Promise<void> {
        FavoritesLogger.log("Favorites plugin started");
        // settings.store.favorites = undefined;
        // settings.store.firstRun = undefined;
        await refreshFavorites();
        // addContextMenuPatch("channel-context", favoritesChannelMenuPatch);
    },
    contextMenus: {
        "channel-context": favoritesChannelMenuPatch,
    },
    startAt: StartAt.WebpackReady,
    requiresRestart: true,
    patches: [
        // Patch to enable toggling Favorites server
        {
            find: "={isPremium",
            replacement: {
                match: /(isPremiumExactly:)\i/,
                replace: "$1() => true"
            }
        },
        // {
        //     find: "\"Unknown user settings error\"",
        //     replacement: {
        //         match: /throw this\.logger\.log\("Unknown user settings error"\),/,
        //         replace: "return;"
        //     }
        // },
        //

        {
            find: '"UserSettingsProtoStore"',
            replacement: [
                {
                    // Overwrite incoming connection settings proto with our local settings
                    match: /(?<=USER_SETTINGS_PROTO_UPDATE_EDIT_INFO:function\((\i)\){)/,
                    replace: (_, props) => `$self.handleProtoUpdateEditInfo(${props});`
                },
            ]
        },
    ],
    handleProtoUpdateEditInfo(e: UserSettingsProtoUpdateEditInfoEvent) {
        // USER_SETTINGS_PROTO_UPDATE_EDIT_INFO
        try {
            // if (proto == null || typeof proto === "string") return;
            FavoritesLogger.log("handleProtoUpdateEditInfo: ", e);

            const favorites: unknown = e.settings.changes?.protoToSave?.favorites;
            if (isFavorite(favorites)) {
                FavoritesLogger.log("handleProtoUpdateEditInfo received with favorites: ", favorites);
                e.settings.changes.protoToSave.favorites = undefined;
            } else {
                FavoritesLogger.warn("handleProtoUpdateEditInfo received without favorites data.");
            }

        } catch (err) {
            FavoritesLogger.error("handleProtoUpdateEditInfo: ", err);
        }
    },
    flux: {
        // USER_SETTINGS_PROTO_UPDATE(settingsUpdate: UserSettingsProtoStoreType): void {
        async USER_SETTINGS_PROTO_UPDATE(settingsUpdate: UserSettingsProtoUpdateEvent): Promise<void> {
            // FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE received: ", settingsUpdate);
            // if (settingsUpdate.local) {
            // DUPLICATED??????????
            const favorites: unknown = settingsUpdate.settings.proto?.favorites;
            if (isFavorite(favorites)) {
                FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE - received with favorites: ", favorites);
                await DataStore.set(FAVORITES_DATA_KEY, favorites);
                updateFavoritesCache(favorites.favoriteChannels, favorites.muted);
                FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE - FavoritesCache: ", FavoritesCache);
            } else {
                FavoritesLogger.warn("USER_SETTINGS_PROTO_UPDATE - received without favorites data.");
            }
            // }
        },
        // USER_SETTINGS_PROTO_UPDATE_EDIT_INFO(settingsUpdate: UserSettingsProtoUpdateEditInfoEvent): void {
        //     FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO received: ", settingsUpdate);
        //     const favorites = settingsUpdate.settings.changes?.protoToSave?.favorites;
        //     if (isFavorite(favorites)) {
        //         FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO received with favorites: ", settingsUpdate);

        //         if (Array.isArray(settingsUpdate.settings.changes?.errorCallbacks)) {
        //             FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO received errorCallbacks 0: ", settingsUpdate.settings.changes?.errorCallbacks);
        //             settingsUpdate.settings.changes.errorCallbacks = [];
        //             // settingsUpdate.settings.changes.errorCallbacks[0] = () => {
        //             //     FavoritesLogger.warn("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO error callback invoked. Refreshing favorites.");
        //             //     // refreshFavorites();
        //             // };
        //             FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO received errorCallbacks 1: ", settingsUpdate.settings.changes?.errorCallbacks);

        //         }
        //     } else {
        //         FavoritesLogger.warn("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO received without favorites data.");
        //     }
        // },
        // USER_SETTINGS_PROTO_ENQUEUE_UPDATE(settingsUpdate: any): void {
        //     FavoritesLogger.log("USER_SETTINGS_PROTO_ENQUEUE_UPDATE received: ", settingsUpdate);
        // },
        // USER_SETTINGS_PROTO_LOAD_IF_NECESSARY(settingsUpdate: any): void {
        //     FavoritesLogger.log("USER_SETTINGS_PROTO_LOAD_IF_NECESSARY received: ", settingsUpdate);
        // }
    }
});
