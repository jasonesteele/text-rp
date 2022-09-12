import { Express } from "express-serve-static-core";
import moment from "moment";
import passport from "passport";
import { Profile, Strategy as DiscordStrategy } from "passport-discord";
import { prisma } from "../context/prisma";

const createOrUpdateAccount = async (profile: Profile) => {
  return prisma.account.upsert({
    where: { id: profile.id },
    update: {
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      email: profile.email,
      emailVerified: profile.verified,
    },
    create: {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      email: profile.email,
      emailVerified: profile.verified,
      updatedAt: moment().toDate(),
    },
  });
};

const createOrUpdateUser = async (profile: Profile) => {
  const account = await createOrUpdateAccount(profile);
  return prisma.user.upsert({
    where: { accountId: profile.id },
    update: {
      name: `${profile.username}#${profile.discriminator}`,
      image: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : undefined,
      updatedAt: moment().toDate(),
    },
    create: {
      name: `${profile.username}#${profile.discriminator}`,
      image: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : undefined,
      account: { connect: { id: account.id } },
    },
  });
};

const setupAuthentication = (app: Express) => {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_ID || "discord-id",
        clientSecret: process.env.DISCORD_SECRET || "discord-secret",
        callbackURL: `${process.env.BASE_URL}/auth/discord/callback`,
        scope: ["identify", "email"],
      },
      async (_accessToken, _refreshToken, profile, cb) => {
        const user = await createOrUpdateUser(profile);

        return cb(undefined, user);
      }
    )
  );
  passport.serializeUser((user, done) => {
    done(undefined, user);
  });
  passport.deserializeUser((obj, done) => {
    done(undefined, obj as Express.User);
  });

  app.get("/auth/discord", passport.authenticate("discord"));

  app.get(
    "/auth/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/",
    }),
    function (_req, res) {
      res.redirect("/"); // Successful auth
    }
  );
};

const setupPassport = (app: Express) => {
  app.use(passport.initialize());
  app.use(passport.session());

  setupAuthentication(app);
};
export default setupPassport;
