/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 nin0dev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
// import { getUserSettingLazy } from "@api/UserSettings";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { proxyLazyWebpack } from "@webpack";
import {
    FluxDispatcher,
    Menu,
    Toasts,
    UserSettingsActionCreators,
    UserSettingsProtoStore,
} from "@webpack/common";

// function searchProtoClassField(localName: string, protoClass: any) {
//     const field = protoClass?.fields?.find(
//         (field: any) => field.localName === localName,
//     );
//     if (!field) return;

//     const fieldGetter = Object.values(field).find(
//         (value) => typeof value === "function",
//     ) as any;
//     return fieldGetter?.();
// }

const PreloadedUserSettingsActionCreators = proxyLazyWebpack(
    () => UserSettingsActionCreators.PreloadedUserSettingsActionCreators,
);
// const FavoriteChannelActionCreators = proxyLazyWebpack(() => UserSettingsActionCreators.FavoriteChannelActionCreators);

// const AppearanceSettingsActionCreators = proxyLazyWebpack(() => searchProtoClassField("favorites", PreloadedUserSettingsActionCreators.ProtoClass));

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
        console.log("channel: ", channel);
        const channelId = channel.id;
        console.log("channelId: ", channelId);

        const guildId = channel.guild_id;
        if (!guildId || typeof guildId !== "string") {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        console.log("guildId: ", guildId);

        console.log(
            "PreloadedUserSettingsActionCreators: ",
            PreloadedUserSettingsActionCreators,
        );

        const FavoriteChannelActionCreators =
            UserSettingsActionCreators.FavoriteChannelActionCreators;
        console.log(
            "FavoriteChannelActionCreators: ",
            FavoriteChannelActionCreators,
        );

        const favorites =
            UserSettingsProtoStore.settings.favorites;
        console.log("favorites: ", favorites);

        const favoriteChannels =
            UserSettingsProtoStore.settings.favorites.favoriteChannels;
        console.log("favoriteChannels: ", favoriteChannels);

        const keys = Object.keys(favoriteChannels);
        const sortedChannelsArray = [];

        // 1. Filter, Extract, and Clone in a single pass
        for (let i = 0; i < keys.length; i++) {
            const id = keys[i];
            const data = favoriteChannels[id];

            if (data.position !== 0 && data.parentId !== "0") {
                // getOwnPropertyDescriptors captures ALL own properties exactly as they are,
                // including non-enumerable ones and symbols.
                const descriptors = Object.getOwnPropertyDescriptors(data);

                // defineProperties applies those exact descriptors to a new object,
                // while we inject the new 'id' property upfront.
                const clonedChannel = Object.defineProperties(
                    { id },
                    descriptors,
                );

                sortedChannelsArray.push(clonedChannel);
            }
        }

        // 2. Sort ascending
        sortedChannelsArray.sort((a, b) => a.position - b.position);

        // 3. Resolve collisions linearly
        let lastPosition = 0;
        for (const channel of sortedChannelsArray) {
            if (channel.position <= lastPosition) {
                channel.position = lastPosition + 1;
            }
            lastPosition = channel.position;
        }

        const newFav1 = FavoriteChannelActionCreators.create({
            nickname: "",
            type: 1,
            position: sortedChannelsArray.length + 1,
            parentId: guildId,
        });
        console.log("newFav1: ", newFav1);
        newFav1.id = channelId;
        console.log("newFav1 with id: ", newFav1);
        sortedChannelsArray.push(newFav1);
        console.log("sortedChannelsArray: ", sortedChannelsArray);

        const newFavoriteChannels = {};
        for (const channel of sortedChannelsArray) {
            console.log("channel: ", channel);
            const id = channel.id;
            const descriptors = Object.getOwnPropertyDescriptors(channel);
            console.log("descriptors: ", descriptors);
            const clonedChannel = Object.defineProperties({ id }, descriptors);
            console.log("clonedChannel: ", clonedChannel);
            //             newFavoriteChannels[id] = { ...channel };
            newFavoriteChannels[id] = clonedChannel;
        }
        console.log("newFavoriteChannels: ", newFavoriteChannels);

        UserSettingsProtoStore.settings.favorites.favoriteChannels =
            newFavoriteChannels;

        const proto = UserSettingsProtoStore.settings;

        FluxDispatcher.dispatch({
            type: "USER_SETTINGS_PROTO_UPDATE",
            local: true,
            partial: true,
            settings: {
                type: 1,
                proto,
            },
        });
    } catch (error) {
        console.error("Error in addToFavorite:", error);
        //         Toasts.show({
        //             type: Toasts.Type.FAILURE,
        //             message: "Failed to jump to message. Check console for details.",
        //             id: Toasts.genId()
        //         });
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
    dependencies: ["UserSettingsAPI", "ContextMenuAPI"],
    start() {
        // DeveloperMode needs to be enabled for the context menu to be shown
        // DeveloperMode.updateSetting(true);
        console.log("Favorites plugin started");
    },
    contextMenus: {
        "channel-context": contextMenuPatch,
    },
});
