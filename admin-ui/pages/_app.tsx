import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { connect, bootstrap, useAdmin } from "@vtex/raccoon-next";
import {
  ChatProvider,
  useAgentPlatform,
  AgenticUIProvider,
  createAgent,
} from "@vtex/agentic-ui";
import { agents } from '../agents'

import "@vtex/agentic-ui/css";
import "@vtex/shoreline/css";
import "../src/components/OptionPicker/index.css";
import "../src/components/CampaignStepsPanel/index.css";

// Side-effect import: runs all registerTool() calls before the chat renders.
import "../src/tools";

// Array of agents for useAgentPlatform
connect();

function AppContent({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { locale = "en-US", account, token } = useAdmin();

  const { isLoading, agent, error } = useAgentPlatform({
    agents,
    pathname: router.asPath,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error || !agent) {
    return <div>Failed to load agent</div>;
  }

  return (
    <AgenticUIProvider
      agent={agent}
      locale={locale}
      account={account}
      token={token}
      >
        <ChatProvider>
          <Component {...pageProps} />
        </ChatProvider>
    </AgenticUIProvider>
  )
}

function App(props: AppProps) {
  return <AppContent {...props} />
}

export default bootstrap(App)

