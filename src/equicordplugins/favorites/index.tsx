/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 nin0dev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { Channel, type FavoriteChannels, type Guild } from "@vencord/discord-types";
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

const BINARY_READ_OPTIONS = findByPropsLazy("readerFactory");
const FavoritesLogger = new Logger("Favorites");

function searchProtoClassField(localName: string, protoClass: any) {
    const field = protoClass?.fields?.find((field: any) => field.localName === localName);
    if (!field) return;

    const fieldGetter = Object.values(field).find(value => typeof value === "function") as any;
    return fieldGetter?.();
}

const PreloadedUserSettingsActionCreators = proxyLazyWebpack(() => UserSettingsActionCreators.PreloadedUserSettingsActionCreators);
const FavoritesSettingsActionCreators = proxyLazyWebpack(() => searchProtoClassField("favorites", PreloadedUserSettingsActionCreators.ProtoClass));
const PreloadedFavoriteChannelActionCreators = proxyLazyWebpack(() => UserSettingsActionCreators.FavoriteChannelActionCreators);

export function FavoriteIcon() {
    return (
        <svg
            aria-hidden="true"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                fill="currentColor"
                d="M10.81 2.86c.38-1.15 2-1.15 2.38 0l1.89 5.83h6.12c1.2 0 1.71 1.54.73 2.25l-4.95 3.6 1.9 5.82a1.25 1.25 0 0 1-1.93 1.4L12 18.16l-4.95 3.6c-.98.7-2.3-.25-1.92-1.4l1.89-5.82-4.95-3.6a1.25 1.25 0 0 1 .73-2.25h6.12l1.9-5.83Z"
            ></path>
        </svg>
    );
}

function addToFavorite(channel: any) {
    try {
        if (!channel) {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        FavoritesLogger.log("channel: ", channel);
        const channelId = channel.id;
        FavoritesLogger.log("channelId: ", channelId);

        const guildId = channel.guild_id;
        if (!guildId || typeof guildId !== "string") {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        FavoritesLogger.log("guildId: ", guildId);

        if (PreloadedUserSettingsActionCreators == null || FavoritesSettingsActionCreators == null || PreloadedFavoriteChannelActionCreators == null || !BINARY_READ_OPTIONS) {
            FavoritesLogger.error("PreloadedUserSettingsActionCreators: ", PreloadedUserSettingsActionCreators);
            FavoritesLogger.error("FavoritesSettingsActionCreators: ", FavoritesSettingsActionCreators);
            FavoritesLogger.error("PreloadedFavoriteChannelActionCreators: ", PreloadedFavoriteChannelActionCreators);
            FavoritesLogger.error("BINARY_READ_OPTIONS: ", BINARY_READ_OPTIONS);
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        FavoritesLogger.log(
            "PreloadedUserSettingsActionCreators: ",
            PreloadedUserSettingsActionCreators,
        );
        FavoritesLogger.log(
            "PreloadedFavoriteChannelActionCreators: ",
            PreloadedFavoriteChannelActionCreators,
        );
        FavoritesLogger.log(
            "FavoritesSettingsActionCreators: ",
            FavoritesSettingsActionCreators,
        );
        FavoritesLogger.log(
            "BINARY_READ_OPTIONS: ",
            BINARY_READ_OPTIONS,
        );

        const currentFavoritesSettings = PreloadedUserSettingsActionCreators.getCurrentValue().favorites;

        const newFavoritesSettingsProto = FavoritesSettingsActionCreators.create();
        // const newFavoritesSettingsProto = FavoritesSettingsActionCreators.getCurrentValue()?.create();
        // const newFavoritesSettingsProto = FavoritesSettingsActionCreators.ProtoClass.create();
        // const newFavoritesSettingsProto = currentFavoritesSettings != null
        //     ? FavoritesSettingsActionCreators.fromBinary(FavoritesSettingsActionCreators.toBinary(currentFavoritesSettings), BINARY_READ_OPTIONS)
        //     : FavoritesSettingsActionCreators.create();

        FavoritesLogger.log(
            "newFavoritesSettingsProto: ",
            newFavoritesSettingsProto,
        );

        // let preloadFavoriteChannels: Record<string, FavoriteChannels> | undefined | null = PreloadedUserSettingsActionCreators.getCurrentValue()?.favorites?.favoriteChannels;
        const preloadFavoriteChannels: Record<string, FavoriteChannels> | undefined = UserSettingsProtoStore.settings?.favorites?.favoriteChannels;

        if (preloadFavoriteChannels == null) {
            FavoritesLogger.error("Favorite channels data not available.");
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        FavoritesLogger.log(
            "preloadFavoriteChannels: ",
            preloadFavoriteChannels,
        );

        const sortedChannelsArray: (FavoriteChannels & { id: string; })[] = Object.entries(preloadFavoriteChannels)
            // 1. Filter BEFORE mapping. This prevents the engine from allocating
            // memory for objects that will just be immediately discarded.
            .filter(([id, data]) => {
                const ch: Channel | undefined = ChannelStore.getChannel(id);
                if (ch != null) {
                    const guild: Guild = GuildStore.getGuild(ch.guild_id);
                    FavoritesLogger.log(`\n ${data.position} - channel.id ${id} - channel.name: ${ch.name} - guild.id: ${guild.id} - guild.name: ${guild.name}`, ch);
                    return true;
                } else {
                    FavoritesLogger.warn(`\n ${data.position} - channel.id ${id} not found in ChannelStore`);
                    return false;
                }
            })
            // .filter(([, data]) => data.position !== 0 && data.parentId !== "0")
            // .filter(([, data]) => data.position !== 0)
            // 2. Map to your desired structure
            .map(([id, data]) => ({ id, ...data }))
            // 3. Sort ascending
            .sort((a, b) => a.position - b.position);


        FavoritesLogger.log(
            "sortedChannelsArray 0: ",
            sortedChannelsArray,
        );
        let lastPosition: number = 0;
        for (const channel of sortedChannelsArray) {
            channel.position = lastPosition;
            lastPosition++;
        }
        // 4. Resolve collisions in a single $O(N)$ linear pass
        // let lastPosition = 0;
        // for (const channel of sortedChannelsArray) {
        //     if (channel.position <= lastPosition) {
        //         channel.position = lastPosition + 1;
        //     }
        //     lastPosition = channel.position;
        // }


        FavoritesLogger.log(
            "sortedChannelsArray 1: ",
            sortedChannelsArray,
        );

        sortedChannelsArray.push({ id: channelId, nickname: "", type: 1, position: sortedChannelsArray.length + 1, parentId: guildId });

        FavoritesLogger.log(
            "sortedChannelsArray 2: ",
            sortedChannelsArray,
        );

        for (let i: number = 0, sortedChannelsArrayLen: number = sortedChannelsArray.length; i < sortedChannelsArrayLen; i++) {
            const channel = sortedChannelsArray[i];

            const ch: Channel | undefined = ChannelStore.getChannel(channel.id);
            if (ch != null) {
                const guild: Guild = GuildStore.getGuild(ch.guild_id);
                const parentId: string = ch.parent_id;
                // const parentId: string = ch.parent_id === "0" ? "0" : channel.parentId;

                FavoritesLogger.log(`\n ${channel.position} - channel.id ${channel.id} - channel.name: ${ch.name} - parentId: ${parentId} - guild.id: ${guild.id} - guild.name: ${guild.name}`, ch);



                const newFav: FavoriteChannels = PreloadedFavoriteChannelActionCreators.create({
                    nickname: channel.nickname,
                    type: channel.type,
                    position: channel.position,
                    // parentId: parentId,
                    parentId: "0",
                    // parentId: channel.parentId,
                });

                newFavoritesSettingsProto.favoriteChannels[channel.id] = newFav;
            } else {
                FavoritesLogger.warn(`\n ${channel.position} - channel.id ${channel.id} not found in ChannelStore`);
            }
        }

        FavoritesLogger.log(
            "newFavoritesSettingsProto FINAL: ",
            newFavoritesSettingsProto,
        );

        const newSettingsProto = PreloadedUserSettingsActionCreators.ProtoClass.create();

        FavoritesLogger.log(
            "newSettingsProto 0: ",
            newSettingsProto,
        );

        newSettingsProto.favorites = newFavoritesSettingsProto;

        FavoritesLogger.log(
            "newSettingsProto 1: ",
            newSettingsProto,
        );

        FluxDispatcher.dispatch({
            type: "USER_SETTINGS_PROTO_UPDATE",
            local: true,
            partial: true,
            settings: {
                type: 1,
                proto: newSettingsProto,
            },
        });

        // const keys = Object.keys(preloadFavoriteChannels);
        // const sortedChannelsArray = [];
        // // 1. Filter, Extract, and Clone in a single pass
        // for (let i = 0; i < keys.length; i++) {
        //     const id = keys[i];
        //     const data = preloadFavoriteChannels[id];

        //     if (data.position !== 0 && data.parentId !== "0") {
        //         // getOwnPropertyDescriptors captures ALL own properties exactly as they are,
        //         // including non-enumerable ones and symbols.
        //         const descriptors = Object.getOwnPropertyDescriptors(data);

        //         // defineProperties applies those exact descriptors to a new object,
        //         // while we inject the new 'id' property upfront.
        //         const clonedChannel = Object.defineProperties(
        //             { id },
        //             descriptors,
        //         );

        //         sortedChannelsArray.push(clonedChannel);
        //     }
        // }

        // // 2. Sort ascending
        // sortedChannelsArray.sort((a, b) => a.position - b.position);

        // // 3. Resolve collisions linearly
        // let lastPosition = 0;
        // for (const channel of sortedChannelsArray) {
        //     if (channel.position <= lastPosition) {
        //         channel.position = lastPosition + 1;
        //     }
        //     lastPosition = channel.position;
        // }

        // // const newFav1 = FavoriteChannelActionCreators.create({
        // const newFav1 = PreloadedFavoriteChannelActionCreators.create({
        //     nickname: "",
        //     type: 1,
        //     position: sortedChannelsArray.length + 1,
        //     parentId: guildId,
        // });
        // // console.log("newFav1: ", newFav1);
        // newFav1.id = channelId;
        // // console.log("newFav1 with id: ", newFav1);
        // sortedChannelsArray.push(newFav1);
        // // console.log("sortedChannelsArray: ", sortedChannelsArray);

        // const newFavoriteChannels = {};
        // for (const channel of sortedChannelsArray) {
        //     // console.log("channel: ", channel);
        //     const id = channel.id;
        //     const descriptors = Object.getOwnPropertyDescriptors(channel);
        //     // console.log("descriptors: ", descriptors);
        //     const clonedChannel = Object.defineProperties({ id }, descriptors);
        //     // console.log("clonedChannel: ", clonedChannel);
        //     //             newFavoriteChannels[id] = { ...channel };
        //     newFavoriteChannels[id] = clonedChannel;
        // }
        // FavoritesLogger.log("newFavoriteChannels: ", newFavoriteChannels);

        // UserSettingsProtoStore.settings.favorites.favoriteChannels = newFavoriteChannels;

        // const proto = PreloadedUserSettingsActionCreators.ProtoClass.create();
        // // const proto = UserSettingsProtoStore.settings;
        // FluxDispatcher.dispatch({
        //     type: "USER_SETTINGS_PROTO_UPDATE",
        //     local: true,
        //     partial: true,
        //     settings: {
        //         type: 1,
        //         proto: UserSettingsProtoStore.settings,
        //     },
        // });
    } catch (error) {
        FavoritesLogger.error("Error in addToFavorite:", error);
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "Failed to add channel to favorites.",
            id: Toasts.genId(),
        });
    }
}

const contextMenuPatch: NavContextMenuPatchCallback = (
    children,
    { channel },
) => {
    children.push(
        <Menu.MenuItem
            id="AddFavorite"
            label={<span>Add to Favorites</span>}
            icon={FavoriteIcon}
            action={() => {
                addToFavorite(channel);
            }}
        />,
    );
};

export default definePlugin({
    name: "Favorites",
    description:
        "Manage your favorite channels",
    tags: ["Appearance", "Customisation", "Organisation", "Servers"],
    authors: [Devs.insilications],
    dependencies: ["ContextMenuAPI"],
    start() {
        // DeveloperMode needs to be enabled for the context menu to be shown
        // DeveloperMode.updateSetting(true);
        console.log("Favorites plugin started");
    },
    contextMenus: {
        "channel-context": contextMenuPatch,
    },
    // flux: {
    //     USER_SETTINGS_PROTO_UPDATE(settingsUpdate: UserSettingsProtoStoreType) {
    //         FavoritesLogger.log("USER_SETTINGS_PROTO_UPDATE received: ", settingsUpdate);
    //         // const protoStatus = settingsUpdate.settings.proto.status;

    //         // if (protoStatus !== undefined) {
    //         //     const steamStatus: SteamStatus = settings.store[`${protoStatus.status.value}Status`];

    //         //     if (settings.store.goInvisibleIfActivityIsHidden && !protoStatus.showCurrentGame.value) {
    //         //         open(`steam://friends/status/${SteamStatus.Invisible}`);

    //         //         return;
    //         //     }
    //         //     if (steamStatus === SteamStatus.None) { return; }

    //         //     // Open steam protocol URI for status change
    //         //     open(`steam://friends/status/${steamStatus}`);
    //         // }
    //     }
    // }
});
