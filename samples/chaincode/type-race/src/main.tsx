/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
  PrimedComponent,
  SimpleComponentInstantiationFactory,
} from "@prague/aqueduct";
import {
  IComponentHTMLVisual,
} from "@prague/container-definitions";
import {
  SharedMap,
} from "@prague/map";
import {
  IComponentContext,
  IComponentRuntime,
} from "@prague/runtime-definitions";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { TextGenerator } from "./textGenerator";
import { ChangeEvent } from "react";
import { OtherTextView } from "./otherTextView";
import { TextMatch } from "./textMatch";
// import * as style from "./style.css";
const style = require("./style.css");

/**
 * Clicker example using view interfaces and stock component classes.
 */
export class TypeRace extends PrimedComponent implements IComponentHTMLVisual {
  private static readonly supportedInterfaces = ["IComponentHTMLVisual", "IComponentHTMLRender"];
  private readonly textGenerator = new TextGenerator();
  private username: string;
  private readonly otherUsernames: Set<string> = new Set<string>();
  private wpm: number = 0;
  private finished: boolean = false;
  private countdown: number = 0;
  private textMatch: TextMatch;

  private readonly targetTextKey = "target-text";
  private get targetText(): string {
    return this.root.get(this.targetTextKey);
  }
  private setThisPlayerText(text: string) {
    this.root.set(this.getPlayerKey(this.username), text);
  }
  private getPlayerText(username: string): string {
    return this.root.get(this.getPlayerKey(username));
  }
  private setThisPlayerWPM(wpm: string) {
    this.root.set(this.getPlayerKey(this.username) + "/wpm", wpm);
  }
  private getPlayerWPM(username: string): string {
    return this.root.get(this.getPlayerKey(username) + "/wpm");
  }
  private setThisPlayerPlace() {
    this.root.wait<number>("players finished count").then( (place) => {
      this.root.set(this.getPlayerKey(this.username) + "/place", place + 1);
      this.root.set("players finished count", place + 1);
    });
  }
  private getPlayerPlace(username: string): number {
    return this.root.get(this.getPlayerKey(username) + "/place");
  }
  private getPlayerKey(username: string): string {
    return `player/${username}`;
  }
  private get gameStarted(): boolean {
    return this.root.get("started");
  }
  private getWinner(): string | undefined {
    return this.root.get("winner");
  }
  private setWinner() {
    this.root.set("winner", this.username);
  }

  private static readonly countDownIncrementTimeMs = 1000;
  private static readonly countDownIncrementCount = 3;

  /**
   * Create is where you do setup for your component. This is only called once the first time your component
   * is created. Anything that happens in create will happen before any other user will see the component.
   */
  protected async create() {
    // Calling super.create() creates a root SharedMap that you can work off.
    await super.create();
    this.root.set(this.targetTextKey, this.textGenerator.generateText());
    this.root.set("started", false);
    this.root.set("players finished count", 0);
  }

  /**
   * Static load function that allows us to make async calls while creating our object.
   * This becomes the standard practice for creating components in the new world.
   * Using a static allows us to have async calls in class creation that you can't have in a constructor
   */
  public static async load(runtime: IComponentRuntime, context: IComponentContext): Promise<TypeRace> {
    const typeRace = new TypeRace(runtime, context, TypeRace.supportedInterfaces);
    await typeRace.initialize();

    return typeRace;
  }


  public render(div: HTMLElement) {
    if (!this.textMatch) {
      this.textMatch = new TextMatch(this.targetText);
    }

    // render
    const rerender = () => {
      const otherTextViews = [...this.otherUsernames].map((value) => {
        return (
          <OtherTextView
            username={value}
            medal={this.getMedal(value)}
            getWPM={() => this.getPlayerWPM(value)}
            getText={() => this.getPlayerText(value)}
            textMatch={this.textMatch}>
          </OtherTextView>
        )
      });

      // breakdown target text
      const targetText = this.targetText;
      const playerText = this.getPlayerText(this.username) || "";
      const match = this.textMatch.match(playerText);
      
      // wpm
      if (!this.finished) {
        const wpm = (match.firstIncorrectIndex / 5) * 1000 * 60 / (new Date().getTime() - this.root.get("start time"));
        this.wpm = wpm ? wpm : 0;
      }
      
      // handle winner
      let winner = this.getWinner();
      if (match.firstIncorrectIndex === targetText.length) {
        if (!winner) {
          this.setWinner();
          winner = this.getWinner();
        }
        if (!this.finished) {
          this.setThisPlayerPlace();
          this.finished = true;
        }
      }
      const winText = !winner ? "" : winner === this.username ? "You Win!" : "You Lose!";

      ReactDOM.render(
        <div>
          <div>
            <button disabled={this.gameStarted} onClick={this.startClick.bind(this)}>Start</button>
            <span style={this.finished ? {color: 'green'} : {}}>
              {"           " + this.username}
              {"           " + this.wpm.toFixed(1) + " wpm"}
              {"           " + this.getMedal(this.username)}
            </span>
          </div>
          <div style={{fontSize: "xx-large"}}>
            {winText}
          </div>
          <div>
            <p style={{fontSize: "larger"}}>
              <span style={{color: "green"}}><u>{match.correctText}</u></span>
              <span style={{color: "red"}}><u>{match.incorrectText}</u></span>
              <u>{match.remainingText}</u>
            </p>
          </div>
          <div>
            <textarea disabled={!this.gameStarted} onChange={this.updateText.bind(this)} value={playerText}></textarea>
          </div>
          <br /><br />
          <div>
            {otherTextViews}
          </div>
          <div className={this.countdown ? style.overlay : style.hidden}>
            <div className={style.text}>
              {this.countdown}
            </div>
          </div>
        </div>,
        div
      );
    };

    rerender();
    this.root.on("valueChanged", (e) => {
      if (e.key === "started") {
        /*
        this.countdown = TypeRace.countDownIncrementCount;
        const countDown = () => {
          if (--this.countdown > 0) {
            setTimeout(countDown, TypeRace.countDownIncrementTimeMs);
          }
          rerender();
        }
        setTimeout(countDown, TypeRace.countDownIncrementTimeMs);
        */
       [...Array(TypeRace.countDownIncrementCount + 1).keys()].forEach((e) =>
         setTimeout(() => {
           this.countdown = e;
           rerender();
         }, (TypeRace.countDownIncrementCount - e) * TypeRace.countDownIncrementTimeMs)
       );
      } else {
        rerender();
      }
    });

    if (this.runtime.connected) {
      this.connectedSetup(this.runtime.clientId, rerender);
    }
    this.runtime.on("connected", clientId => this.connectedSetup(clientId, rerender));

    return div;
  }

  public remove() {
    throw new Error("Not Implemented");
  }

  private startClick(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    this.root.set("started", true);
    this.root.set("start time", new Date().getTime() + (TypeRace.countDownIncrementCount * TypeRace.countDownIncrementTimeMs));
  }

  private updateText(e: ChangeEvent<HTMLTextAreaElement>) {
    this.setThisPlayerText(e.currentTarget.value);
    this.setThisPlayerWPM(this.wpm.toFixed(1).toString());
  }

  private getMedal(username: string): string {
    const place = this.getPlayerPlace(username);
      switch (place) {
          case undefined: return "";
          case 1: return "🥇";
          case 2: return "🥈";
          case 3: return "🥉";
          default: return "😞";
      }
  }

  private refreshOtherUsers(): void {
    if (!this.gameStarted) {
      const users = [...this.runtime.getQuorum().getMembers().values()];
      this.otherUsernames.clear();
      users.map((u) => (u.client.user as any).name).forEach((un) => {
        if (un !== this.username) {
          this.otherUsernames.add(un);
        }
      });
    }
  }

  private connectedSetup(clientId: string, rerender: () => void): void {
    const user = this.runtime.getQuorum().getMember(clientId);
      this.username = (user.client.user as any).name;
      this.setThisPlayerText("");
      this.setThisPlayerWPM("0");
      
      // adding members should refresh the other users list
      this.runtime.getQuorum().on("addMember", () => {
        this.refreshOtherUsers();
        rerender();
      });

      this.refreshOtherUsers();
      rerender();
  }
}

/**
 * This is where you define all your Distributed Data Structures
 */
export const TyperaceInstantiationFactory = new SimpleComponentInstantiationFactory(
  [
    SharedMap.getFactory([]),
  ],
  TypeRace.load
);