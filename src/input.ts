// 把键盘、手柄、触屏按钮合并成同一个 Input
import Phaser from "phaser";
import type { Input } from "./player";

/** 触屏按钮写这里，页面上的按钮和测试都可以改 */
export const touchState: Input = { left: false, right: false, jump: false };

export class Controls {
  private keys: Record<string, Phaser.Input.Keyboard.Key[]>;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]) => codes.map((c) => kb.addKey(c, true, false));
    this.keys = {
      left: add(K.LEFT, K.A),
      right: add(K.RIGHT, K.D),
      jump: add(K.Z, K.SPACE, K.K, K.UP, K.W),
    };
  }

  read(): Input {
    const down = (name: string) => this.keys[name].some((k) => k.isDown);
    const pad = this.scene.input.gamepad?.total ? this.scene.input.gamepad.getPad(0) : undefined;
    const stickX = pad ? pad.leftStick.x : 0;
    return {
      left: down("left") || touchState.left || !!pad?.left || stickX < -0.4,
      right: down("right") || touchState.right || !!pad?.right || stickX > 0.4,
      jump: down("jump") || touchState.jump || !!pad?.A,
    };
  }
}
