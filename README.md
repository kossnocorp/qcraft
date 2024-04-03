<h1 style="display: none">Superstate</h1>

<div align="center">
  <img alt="Superstate logo" height="256" src="./logo.png" />

  <h2 style="font-size: 1.5rem; font-weight: 500; border: none;">
    Type-safe JavaScript statecharts
  </h2>

  <div>
    🔒 End-to-end type-safe
    🎯 Easy to read without visualization
    <br/>
    🧩 Highly composable
    ⚡ Lightweight and fast
  </div>

  <br/>
  <hr />
</div>

Take a look:

```ts
import { superstate } from "superstate";

type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("player")
  .state("stopped", "play() -> playing")
  .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
    $.sub("volume", volumeState)
  )
  .state("paused", ["play() -> playing", "stop() -> stopped"]);

type VolumeState = "low" | "medium" | "high";

const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

Even without rendering a chart, it is easy to see the logic.

## Why?

There are many state machine and statechart libraries, including the industry leader [XState](https://stately.ai/docs/xstate). Why bother?

Superstate was [born out of my frustration with TypeScript](https://twitter.com/kossnocorp/status/1771855573304390085). It turned out that typing a graph-based API was an extremely tough challenge, which I bravely accepted.

As statecharts play a central role in any system, set to untangle what is tangled, having complete type-safety is crucial for the task. A typo or unintended usage might ultimately break the app, so the type system must always warn you about the problem.

One reason typing such an API is problematic is the inherent composability of statecharts. This contributes to another problem — readability. That was another reason why I wanted to try my hand at it.

So, when I managed to design an API that is completely type-safe, easy to grasp without visualization, and composable, I thought it would be a crime not to give it a chance and ship it as a library.

So here we go.

## Getting started

### Installation

Start by installing the package:

```sh
npm i superstate
```

### Core concepts

Superstate is an implementation of the statecharts formalism [introduced by David Harel in 1987](https://www.sciencedirect.com/science/article/pii/0167642387900359). It adds hierarchy to state machines, making it possible to express complex logic without losing readability.

To get started, you only need to understand a few concepts:

- **State**: The available system states. Only a single state can be active at a time (e.g. `stopped` or `playing`). A state might have _substates_.
- **Event**: What triggers _transitions_ between the system _states_ (e.g. `up()` or `play()`). You send _events_ to control the system.
- **Transition**: The process of moving from one _state_ to another. It's coupled with the triggering _event_ and the next _state_ (e.g. `up() -> medium`).
- **Action**: What happens during _transitions_, upon entering or exiting a _state_ (e.g. `playMusic!`). _Actions_ call your code.

Everything else is built on top of these concepts.

All the concepts have consistent naming, enabling you to quickly distinguish them. For instance, _events_ have `()` at the end, and _actions_ have `!`. Flow of the system are defined with `->`.

### Basics

The `superstate` function creates a new statechart. It accepts the name, available states as the generic type and returns the builder object:

```ts
const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

The first state, `low`, is the initial state that the statechart will enter when it starts. The `state` method accepts the name and list of state traits—in this case—transitions.

The events that trigger state transitions are `up()` and `down()`. Events always have `()` at the end, which makes them easy to spot.

---

To use the machine, run the `host` method:

```ts
const volume = volumeState.host();

// Subscribe to the state changes:
volume.on(["low", "medium", "high"], (target) =>
  sound.setVolume(target.state.name)
);

// Trigger the events:
volume.send("up()");

// Check the current state:
if (volume.in("high")) console.log("The volume is at maximum");
```

The method creates an instance of statechart. It's the object that you will interact with, which holds the actual state.

Using the `on` method you can listen to everything `*`, a single state or an event, or a combination of them:

```ts
// Listen to everything:
volume.on("*", (target) => {
  if (target.type === "state") {
    console.log("State changed to", target.state.name);
  } else {
    console.log("Event triggered", target.event.name);
  }
});

// Will trigger when the state is `low` or when `down()` is sent:
volume.on(["low", "down()"], (target) => {
  if (target.type === "state") {
    console.log("The volume is low");
  } else {
    console.log("The volume is going down");
  }
});
```

The `on` method returns `off` function that unsubscribes the listener:

```ts
const off = volume.on("low", () => {});

setTimeout(() => {
  // Unsubscribe the listener:
  off();
}, 1000);
```

### Guards

Transitions can be guarded, allowing to have conditional transitions:

```ts
type PCState = "on" | "sleep" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "press() -> on")
  .state("on", ($) =>
    $.if("press", ["(long) -> off", "() -> sleep"]).on("restart() -> on")
  )
  .state("sleep", ($) =>
    $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
  );
```

In this example, we used the `if` method to guard the transitions. The `press` event might trigger one of the two transitions: a long press and another for a short press (else).

There are several ways to define state traits, and passing a function as the last argument is one of them. It allows for defining more complex logic.

---

To send an event with a condition, use the `send` method:

```ts
const pc = pcState.host();

// Send the long press event:
const nextState = pc.send("press()", "long");

// The next state is "off":
if (nextState) nextState.name satisfies "off";
```

Unless it's not in the `off` state, the `press` event will transition the statechart to the `off` state.

If you send the `press()` event without the condition, it might transition to the `sleep` or the `on` state:

```ts
// Send the press event:
const nextState = pc.send("press()");

// The next state is "sleep":
if (nextState) nextState.name satisfies "sleep" | "on";
```

### Actions

Actions allow you define side effects that happen when entering or exiting a state or during a transition.

While you trigger the events, the actions trigger your code:

```ts
type ButtonState = "off" | "on";

const buttonState = superstate<ButtonState>("button")
  .state("off", ["-> turnOff!", "press() -> on"])
  .state("on", ["-> turnOn!", "press() -> off"]);
```

You can notice that the state definitions include strings with `!` at the end, i.e., `turnOn!` and `turnOff!`. These are the actions.

They define what happens when the state is entered and force you to handle the side effects in your code:

```ts
// Bind the actions to code:
const button = buttonState.host({
  on: {
    "-> turnOn!": () => console.log("Turning on"),
  },
  off: {
    "-> turnOff!": () => console.log("Turning on"),
  },
});
```

In addition to enter actions (`-> turnOff!`), states can have exit actions (`turnOff! ->`), which are invoked when the state is left:

```ts
// The on state invokes the enter and exit actions:
const buttonState = superstate<ButtonState>("button")
  .state("off", "press() -> on")
  .state("on", ["-> turnOn!", "press() -> off", "turnOff! ->"]);

const button = buttonState.host({
  on: {
    "-> turnOn!": () => console.log("Turning on"),
    "turnOff! ->": () => console.log("Turning off"),
  },
});
```

The transition actions (`press() -> turnOff! -> off`) are invoked during transitions:

```ts
// Actions are invoked on transitions:
const buttonState = superstate<ButtonState>("button")
  .state("off", "press() -> turnOn! -> on")
  .state("on", "press() -> turnOff! -> off");

const button = buttonState.host({
  on: {
    "press() -> turnOff!": () => console.log("Turning on"),
  },
  off: {
    "press() -> turnOn!": () => console.log("Turning off"),
  },
});
```

Like with most Superstate API, there are several ways to define actions, allowing you to choose the right one for the situation.

The events and actions can be defined in the builder function or even mixed with the string-based definitions:

```ts
// Use the builder function to define the states:
const buttonState = superstate<ButtonState>("button")
  .state("on", ($) => $.enter("turnOn!").on("press() -> off").exit("turnOff!"))
  .state("off", ($) => $.on("press() -> on"));
```

### Substates

Substates are states that are nested within a parent state. A state might have multiple substates, making it a parallel state, representing concurrent logic:

```ts
type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("player")
  .state("stopped", "play() -> playing")
  .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
    // Nest the volume state as `volume`
    $.sub("volume", volumeState)
  )
  .state("paused", ["play() -> playing", "stop() -> stopped"]);

type VolumeState = "low" | "medium" | "high";

const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

In this example, we nest the `volumeState` inside the `playing` state. The the `volumeState` will be initialized when the `playing` state is entered and will be destroyed when the `playing` state is exited.

You can send events, subscribe to changes, and access the substate from the parent state:

```ts
const player = playerState.host();

// Send events to the substate:
player.send("playing.volume.up()");

// Subscribe to the substate changes:
player.on("playing.volume.low", (target) => console.log("The volume is low"));

// The parent state will have the substate as a property on `sub`:
const playingState = player.in("playing");
if (playingState) {
  // Access the substate:
  playingState.sub.volume.in("high");
}
```

A state can be final, representing the end of the statechart:

```ts
type OSState = "running" | "sleeping" | "terminated";

const osState = superstate<OSState>("running")
  .state("running", "terminate() -> terminated")
  .state("sleeping", ["wake() -> running", "terminate() -> terminated"])
  // Mark the terminated state as final
  .final("terminated");
```

When nesting in such a state, the parent might connect the final states through an event to a parent state, allowing for a more complex logic:

```ts
type PCState = "on" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "power() -> on")
  .state("on", ($) =>
    $.on("power() -> off")
      // Nest the OS state as `os` and connect the `terminated` state
      // through `shutdown()` event to `off` state of the parent.
      .sub("os", osState, "terminated -> shutdown() -> off")
  );
```

When the OS is terminated, the PC will automatically power off.

---

If a substate has actions, they must be binded when hosting the root statechart.

Look at this fairly complex statechart:

```ts
type OSState = "running" | "sleeping" | "terminated";

const osState = superstate<OSState>("running")
  .state("running", [
    "terminate() -> terminated",
    // Note sleep! action
    "sleep() -> sleep! -> sleeping",
  ])
  .state("sleeping", [
    // Note wake! action
    "wake() -> wake! -> running",
    "terminate() -> terminated",
  ])
  .final("terminated", "-> terminate!");

type PCState = "on" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "power() -> turnOn! -> on")
  .state("on", ($) =>
    // Here we add OS state as a substate
    $.on("power() -> turnOff! -> off").sub(
      "os",
      osState,
      "terminated -> shutdown() -> off"
    )
  );
```

The PC (personal computer) statechart nests OS (operating system). The OS has `sleep!` and `wake!` actions, so when we host the PC statechart, we must bind the `OS` actions as well:

```ts
const pc = pcState.host({
  on: {
    // Here we bind the
    os: {
      running: {
        "sleep() -> sleep!": () => console.log("Sleeping"),
      },
      sleeping: {
        "wake() -> wake!": () => console.log("Waking up"),
      },
      terminated: {
        "-> terminate!": () => console.log("Terminating"),
      },
    },
    "power() -> turnOff!": () => console.log("Turning off"),
  },
  off: {
    "power() -> turnOn!": () => console.log("Turning on"),
  },
});
```

## API

**🚧 Work in progress, [follow for updates](https://twitter.com/kossnocorp)**

TODO: Describe each method

## Acknowledgments

Special thanks to [Eric Vicenti](https://github.com/ericvicenti) for donatime the npm package name `superstate` to this project.

The project wouldn't exist without the [XState](https://stately.ai/docs/xstate) library, a great source of inspiration and knowledge.

## Changelog

See [the changelog](./CHANGELOG.md).

## License

[MIT © Sasha Koss](https://kossnocorp.mit-license.org/)
