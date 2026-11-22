import { Uniform } from 'three'
import { Effect, EffectAttribute } from 'postprocessing'

/**
 * Desaturates everything that is further away than `focusDist` (metres from the camera).
 * The focused item floats in front of the room, so only the background loses colour.
 */
const fragment = /* glsl */ `
  uniform float amount;
  uniform float focusDist;

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    float viewDist = -getViewZ(depth);
    float bg = smoothstep(focusDist, focusDist + 0.2, viewDist);
    float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    outputColor = vec4(mix(inputColor.rgb, vec3(luma), amount * bg), inputColor.a);
  }
`

export class DesaturateBackgroundEffect extends Effect {
  constructor() {
    super('DesaturateBackgroundEffect', fragment, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['amount', new Uniform(0)],
        ['focusDist', new Uniform(100)],
      ]),
    })
  }
  set amount(v: number) {
    this.uniforms.get('amount')!.value = v
  }
  get amount() {
    return this.uniforms.get('amount')!.value
  }
  set focusDist(v: number) {
    this.uniforms.get('focusDist')!.value = v
  }
}
