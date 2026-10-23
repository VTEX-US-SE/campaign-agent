import React from "react";
import { Chat } from "@vtex/agentic-ui";
import styles from "./index.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <Chat />
      </main>
    </div>
  );
}


