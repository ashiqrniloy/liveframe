import { createRoot } from "react-dom/client";
import { baseCss } from "@arnilo/liveframe/css";
import { conformancePage } from "@arnilo/liveframe/conformance/react";
import { Preview } from "@arnilo/liveframe/preview/react";
import { createRenderer } from "@arnilo/liveframe/react";

/** The page an adopter's bundler builds: every browser subpath, installed peers only. */
export const boot = () => ({ createRoot, baseCss, conformancePage, Preview, createRenderer });
