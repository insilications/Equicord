/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 nin0dev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    sendBotMessage,
} from "@api/Commands";
import { getUserSettingLazy } from "@api/UserSettings";
import { InfoIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import { getCurrentChannel, getCurrentGuild } from "@utils/discord";
import definePlugin from "@utils/types";
import { GuildMember } from "@vencord/discord-types";
import {
    GuildMemberStore,
    GuildRoleStore,
    Menu,
    Parser,
    UserSettingsActionCreators,
    UserSettingsProtoStore,
    FluxDispatcher,
    Toasts,
} from "@webpack/common";

import { showInRoleModal } from "./RoleMembersModal";

import { proxyLazyWebpack } from "@webpack";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";

const DeveloperMode = getUserSettingLazy("appearance", "developerMode")!;

function searchProtoClassField(localName: string, protoClass: any) {
    const field = protoClass?.fields?.find(
        (field: any) => field.localName === localName,
    );
    if (!field) return;

    const fieldGetter = Object.values(field).find(
        (value) => typeof value === "function",
    ) as any;
    return fieldGetter?.();
}

const PreloadedUserSettingsActionCreators = proxyLazyWebpack(
    () => UserSettingsActionCreators.PreloadedUserSettingsActionCreators,
);
// const FavoriteChannelActionCreators = proxyLazyWebpack(() => UserSettingsActionCreators.FavoriteChannelActionCreators);

// const AppearanceSettingsActionCreators = proxyLazyWebpack(() => searchProtoClassField("favorites", PreloadedUserSettingsActionCreators.ProtoClass));

function getMembersInRole(roleId: string, guildId: string) {
    const members = GuildMemberStore.getMembers(guildId);
    const membersInRole: GuildMember[] = [];
    members.forEach((member) => {
        if (member.roles.includes(roleId)) {
            membersInRole.push(member);
        }
    });
    return membersInRole;
}

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
                class=""
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
        console.log(`channel: `, channel);
        const channelId = channel.id;
        console.log(`channelId: `, channelId);

        const guildId = channel.guild_id;
        if (!guildId || typeof guildId != "string") {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "Channel information not available.",
                id: Toasts.genId(),
            });
            return;
        }
        console.log(`guildId: `, guildId);

        console.log(
            `PreloadedUserSettingsActionCreators: `,
            PreloadedUserSettingsActionCreators,
        );

        const FavoriteChannelActionCreators =
            UserSettingsActionCreators.FavoriteChannelActionCreators;
        console.log(
            `FavoriteChannelActionCreators: `,
            FavoriteChannelActionCreators,
        );

        const favoriteChannels =
            UserSettingsProtoStore.settings.favorites.favoriteChannels;
        console.log(`favoriteChannels: `, favoriteChannels);

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
        console.log(`newFav1: `, newFav1);
        newFav1.id = channelId;
        console.log(`newFav1 with id: `, newFav1);
        sortedChannelsArray.push(newFav1);
        console.log(`sortedChannelsArray: `, sortedChannelsArray);

        const newFavoriteChannels = {};
        for (const channel of sortedChannelsArray) {
            console.log(`channel: `, channel);
            const id = channel.id;
            const descriptors = Object.getOwnPropertyDescriptors(channel);
            console.log(`descriptors: `, descriptors);
            const clonedChannel = Object.defineProperties({ id }, descriptors);
            console.log(`clonedChannel: `, clonedChannel);
            //             newFavoriteChannels[id] = { ...channel };
            newFavoriteChannels[id] = clonedChannel;
        }
        console.log(`newFavoriteChannels: `, newFavoriteChannels);

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

        //         UserSettingsProtoStore.settings.favorites.favoriteChannels[channel]
        //
        //         UserSettingsProtoStore.settings.favorites.favoriteChannels[
        //             "1144213473853702237"
        //         ] = newFav1;
        //
        //         const newFav2 = FavoriteChannelActionCreators.create({
        //             nickname: "",
        //             type: 1,
        //             position: 15,
        //             parentId: "1091220969173028894",
        //         });
        //         console.log(`newFav2: `, newFav2);
        //
        //         UserSettingsProtoStore.settings.favorites.favoriteChannels[
        //             "1149806689244168292"
        //         ] = newFav2;
        //
        //         const proto = UserSettingsProtoStore.settings;
        //
        //         FluxDispatcher.dispatch({
        //             type: "USER_SETTINGS_PROTO_UPDATE",
        //             local: true,
        //             partial: true,
        //             settings: {
        //                 type: 1,
        //                 proto,
        //             },
        //         });

        //         const channelParentId = channel.parent_id;

        //         let userId: string;
        //         if (targetUserId) {
        //             userId = targetUserId;
        //         } else {
        //             const currentUser = UserStore.getCurrentUser();
        //             userId = currentUser.id;
        //         }
        //         const messageId = await findLastMessageFromUser(
        //             guildId,
        //             channelId,
        //             userId,
        //         );
        //         if (messageId) {
        //             const url = `/channels/${guildId}/${channelId}/${messageId}`;
        //             NavigationRouter.transitionTo(url);
        //         }
    } catch (error) {
        console.error("Error in addToFavorite:", error);
        //         Toasts.show({
        //             type: Toasts.Type.FAILURE,
        //             message: "Failed to jump to message. Check console for details.",
        //             id: Toasts.genId()
        //         });
    }
}

const ChannelContextMenuPatch: NavContextMenuPatchCallback = (
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
    name: "InRole",
    description:
        "Know who is in a role with the role context menu or /inrole command (read plugin info!)",
    tags: ["Commands", "Roles"],
    authors: [Devs.nin0dev],
    dependencies: ["UserSettingsAPI", "CommandsAPI"],
    start() {
        // DeveloperMode needs to be enabled for the context menu to be shown
        DeveloperMode.updateSetting(true);
        console.log(`DeveloperMode: `, DeveloperMode);
        console.log(`DeveloperMode.getSetting(): `, DeveloperMode.getSetting());
    },
    settingsAboutComponent: () => {
        return (
            <>
                <Paragraph
                    style={{
                        fontSize: "1.2rem",
                        marginTop: "15px",
                        fontWeight: "bold",
                    }}
                >
                    {Parser.parse(":warning:")} Limitations
                </Paragraph>
                <Paragraph style={{ marginTop: "10px", fontWeight: "500" }}>
                    If you don't have mod permissions on the server, and that
                    server is large (over 100 members), the plugin may be
                    limited in the following ways:
                </Paragraph>
                <Paragraph>• Offline members won't be listed</Paragraph>
                <Paragraph>
                    • Up to 100 members will be listed by default. To get more,
                    scroll down in the member list to load more members.
                </Paragraph>
                <Paragraph>
                    • However, friends will always be shown regardless of their
                    status.
                </Paragraph>
            </>
        );
    },

    commands: [
        {
            name: "inrole",
            description: "Know who is in a role",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "role",
                    description: "The role",
                    type: ApplicationCommandOptionType.ROLE,
                    required: true,
                },
            ],
            execute: (args, ctx) => {
                // Guild check
                if (!ctx.guild) {
                    return sendBotMessage(ctx.channel.id, {
                        content: "Make sure that you are in a server.",
                    });
                }
                const role = args[0].value;
                showInRoleModal(
                    getMembersInRole(role, ctx.guild.id),
                    role,
                    ctx.channel.id,
                );
            },
        },
        {
            name: "fav",
            description: "Fav test 1",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: (args, ctx) => {
                console.log(
                    `PreloadedUserSettingsActionCreators: `,
                    PreloadedUserSettingsActionCreators,
                );

                const FavoriteChannelActionCreators =
                    UserSettingsActionCreators.FavoriteChannelActionCreators;
                console.log(
                    `FavoriteChannelActionCreators: `,
                    FavoriteChannelActionCreators,
                );

                const newFav1 = FavoriteChannelActionCreators.create({
                    nickname: "",
                    type: 1,
                    position: 14,
                    parentId: "1144222818574278727",
                });
                console.log(`newFav1: `, newFav1);

                UserSettingsProtoStore.settings.favorites.favoriteChannels[
                    "1144213473853702237"
                ] = newFav1;

                const newFav2 = FavoriteChannelActionCreators.create({
                    nickname: "",
                    type: 1,
                    position: 15,
                    parentId: "1091220969173028894",
                });
                console.log(`newFav2: `, newFav2);

                UserSettingsProtoStore.settings.favorites.favoriteChannels[
                    "1149806689244168292"
                ] = newFav2;

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

                //                 const favoritesSettings = UserSettingsProtoStore.settings.favorites;
                //                 console.log(`favoritesSettings: `, favoritesSettings);
                //
                //                 console.log(`UserSettingsActionCreators: `, UserSettingsActionCreators);
                //                 const FavoriteChannelActionCreators = proxyLazyWebpack(() => UserSettingsActionCreators.FavoriteChannelActionCreators);
                //                 console.log(`FavoriteChannelActionCreators: `, FavoriteChannelActionCreators);

                //                 const FavoriteChannelActionCreators2 = proxyLazyWebpack(() => searchProtoClassField("appearance", FavoriteChannelActionCreators.ProtoClass));
                //                 const FavoritesStore = getUserSettingLazy("favorites", "favoriteChannels")!;
                //                 const FavoritesStore = getUserSettingLazy("favorites", "muted")!;
                //                 console.log(`FavoritesStore: `, FavoritesStore);
                //                 console.log(`FavoritesStore.getSetting(): `, FavoritesStore.getSetting());
            },
        },
    ],
    contextMenus: {
        "channel-context": ChannelContextMenuPatch,
        "dev-context"(children, { id }: { id: string }) {
            const guild = getCurrentGuild();
            if (!guild) return;

            const channel = getCurrentChannel();
            if (!channel) return;

            const role = GuildRoleStore.getRole(guild.id, id);
            if (!role) return;

            children.push(
                <Menu.MenuItem
                    id="vc-view-inrole"
                    label="View Members in Role"
                    action={() => {
                        showInRoleModal(
                            getMembersInRole(role.id, guild.id),
                            role.id,
                            channel.id,
                        );
                    }}
                    icon={InfoIcon}
                    leadingAccessory={{ type: "icon", icon: InfoIcon }}
                />
            );
        },
        message(children, { message }: { message: any }) {
            const guild = getCurrentGuild();
            if (!guild) return;

            const roleMentions = message.content.match(/<@&(\d+)>/g);
            if (!roleMentions?.length) return;

            const channel = getCurrentChannel();
            if (!channel) return;

            const roleIds = roleMentions.map(
                (mention) => mention.match(/<@&(\d+)>/)![1],
            );

            const role = GuildRoleStore.getRole(guild.id, roleIds);
            if (!role) return;

            children.push(
                <Menu.MenuItem
                    id="vc-view-inrole"
                    label="View Members in Role"
                    action={() => {
                        showInRoleModal(
                            getMembersInRole(role.id, guild.id),
                            role.id,
                            channel.id,
                        );
                    }}
                    icon={InfoIcon}
                    leadingAccessory={{ type: "icon", icon: InfoIcon }}
                />
            );
        },
    },
});
