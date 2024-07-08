import { getToken } from "../src";

console.log('token', await getToken({
  akid: process.env.ACCESS_KEY_ID!,
  akkey: process.env.ACCESS_KEY_SECRET!,
}))