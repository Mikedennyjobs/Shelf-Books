"use client";
import { useApp } from "@/lib/store";
import { Icon } from "./ui";
import { SheetHost } from "./sheets";
import { Home, MyBooks, Discover, Search, Genre, Collection, Picks } from "./screens-main";
import { BookPage, PlayerScreen } from "./screens-book";
import { Voices, Upload, AskHistory, Profile, Challenges, Settings } from "./screens-me";
import { Friends, Groups, GroupPage } from "./screens-social";

const SCREENS: Record<string, (arg: any) => React.ReactNode> = {
  home: () => <Home />, mybooks: () => <MyBooks />, discover: () => <Discover />, search: () => <Search />,
  book: (a) => <BookPage arg={a} />, player: () => <PlayerScreen />, genre: (a) => <Genre arg={a} />, collection: (a) => <Collection arg={a} />,
  picks: () => <Picks />, voices: () => <Voices />, upload: () => <Upload />, askhist: () => <AskHistory />, profile: () => <Profile />,
  challenges: () => <Challenges />, settings: () => <Settings />, friends: () => <Friends />, groups: () => <Groups />, group: (a) => <GroupPage arg={a} />,
};
const MORE = new Set(["picks", "voices", "upload", "askhist", "profile", "challenges", "settings", "friends", "groups", "group"]);

export function Shell() {
  const app = useApp();
  const top = app.stack[app.stack.length - 1];
  const name: string = top?.name || app.tab;
  const active = app.sheet?.type === "more" || MORE.has(name) ? "more" : app.tab;
  const tabs = [["home", "Home", "home"], ["mybooks", "My Books", "books"], ["discover", "Discover", "compass"], ["search", "Search", "search"], ["more", "More", "menu"]];
  return (
    <div className="phone">
      <div className="screen" key={`${name}-${app.stack.length}`} style={name === "player" ? { paddingBottom: 0 } : undefined}>
        {(SCREENS[name] || SCREENS.home)(top?.arg)}
      </div>
      {name !== "player" && (
        <nav className="tabbar">
          {tabs.map(([k, l, i]) => (
            <button key={k} className={`tab ${active === k ? "on" : ""}`} onClick={() => (k === "more" ? app.openSheet({ type: "more" }) : app.setTab(k))}>
              <Icon n={i} s={28} />{l}
            </button>
          ))}
        </nav>
      )}
      <SheetHost />
      <div className={`toast ${app.toastMsg ? "show" : ""}`}>{app.toastMsg}</div>
    </div>
  );
}
