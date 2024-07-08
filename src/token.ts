// @ts-ignore
import { RPCClient } from "@alicloud/pop-core";

interface TokenConfig {
  akid: string;
  akkey: string;
  endpoint?: string;
  apiVer?: string;
}

export async function getToken({
  akid,
  akkey,
  endpoint = "http://nls-meta.cn-shanghai.aliyuncs.com",
  apiVer = "2019-02-28"
}: TokenConfig): Promise<any> {
  const client = new RPCClient({
    accessKeyId: akid,
    accessKeySecret: akkey,
    endpoint: endpoint,
    apiVersion: apiVer
  });

  return client.request("CreateToken");
}
