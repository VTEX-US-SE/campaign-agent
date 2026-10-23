import { vtexCommerceProxy } from "@vtex/raccoon-proxy";
import { NextApiRequest, NextApiResponse } from "next";

/**
 * This is super important. Do not change it.
 * @see https://nextjs.org/docs/api-routes/api-middlewares#custom-config
 */
export const config = {
  api: {
    externalResolver: true, // see https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/servers.md#nextjs
    bodyParser: false, // see https://github.com/chimurai/http-proxy-middleware/issues/171#issuecomment-356218599
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  vtexCommerceProxy(req, res, (result: unknown) => {
    if (result instanceof Error) {
      throw result;
    }
  });
}


