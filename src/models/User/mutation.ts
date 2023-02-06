import { builder } from "../../builder";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AUTH_SECRET } from "../../utils/auth";

const UserCreateInput = builder.inputType("UserCreateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

builder.mutationField("signUp", (t) =>
  t.prismaField({
    type: "User",
    args: {
      data: t.arg({
        type: UserCreateInput,
        required: true,
      }),
    },
    errors: {
      types: [Error],
    },
    resolve: async (query, root, args, ctx, info) => {
      const hashedPassword = bcrypt.hashSync(args.data.password, 10);
      const accessToken = sign({ email: args.data.email }, AUTH_SECRET, {
        expiresIn: "1h",
      });
      const refreshToke = sign({ email: args.data.email }, AUTH_SECRET, {
        expiresIn: "7d",
      });

      // if user already exists throw error
      const user = await ctx.prisma.user.findUnique({
        where: {
          email: args.data.email,
        },
      });
      if (user) {
        throw new Error("User already exists please login");
      }

      return await ctx.prisma.user.create({
        data: {
          name: args.data.name,
          email: args.data.email,
          password: hashedPassword,
          access_token: accessToken,
          refresh_token: refreshToke,
        },
      });
    },
  })
);

// User Login
const UserLoginInput = builder.inputType("UserLoginInput", {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

class Token {
  accessToken: string;
  refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

const UserLoginPayload = builder.objectType(Token, {
  name: "UserLoginPayload",
  fields: (t) => ({
    accessToken: t.exposeString("accessToken"),
    refreshToken: t.exposeString("refreshToken"),
  }),
});

builder.mutationField("login", (t) =>
  t.field({
    type: UserLoginPayload,
    args: {
      data: t.arg({
        type: UserLoginInput,
        required: true,
      }),
    },
    resolve: async (root, args, ctx) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          email: args.data.email,
        },
      });
      if (!user) {
        throw new Error("No user found");
      }
      const valid = await bcrypt.compare(args.data.password, user.password);
      if (!valid) {
        throw new Error("Invalid password");
      }

      const accessToken = sign(
        { userId: user.id },
        user.access_token as string,
        { expiresIn: "15min" }
      );
      const refreshToken = sign(
        { userId: user.id },
        user.refresh_token as string,
        { expiresIn: "1d" }
      );

      return {
        accessToken,
        refreshToken,
      };
    },
  })
);
function signIn(arg0: { userId: number }) {
  throw new Error("Function not implemented.");
}
