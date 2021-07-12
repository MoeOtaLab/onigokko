import './style.css'
import { throttle, clamp, debounce } from 'lodash'
import heroImg from './assets/christmas/3x_RMMV/xmas_santa_3.png'
import snowmenImg from './assets/christmas/2019/snowmen_tiles_3.png'

function setCanvasMeta(canvas: HTMLCanvasElement, canvasConfig: { width: number, height: number, padding?: number }) {
  function setResponseSize() {
    const ratio = canvasConfig.width / canvasConfig.height
    let width = canvasConfig.width
    let height = canvasConfig.height

    const { padding = 0 } = canvasConfig

    const currentWindowWidth = window.innerWidth - padding * 2
    const currentWindowHeight = window.innerHeight - padding * 2

    if (currentWindowHeight > currentWindowWidth / ratio) {
      // if height is enouth, then use 100% width
      width = currentWindowWidth
      height = currentWindowWidth / ratio
    } else {
      // else use 100% height instead.
      width = currentWindowHeight * ratio
      height = currentWindowHeight
    }

    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.margin = `${padding}px`
  }

  const setResponseSizeThrottle = throttle(setResponseSize, 300)

  canvas.width = canvasConfig.width
  canvas.height = canvasConfig.height

  setResponseSize()

  window.addEventListener('resize', setResponseSizeThrottle, false)

  return {
    width: canvasConfig.width,
    height: canvasConfig.height
  }
}

function getImage(imgUrl: string) {
  const image = new Image()
  image.src = imgUrl

  return image
}

function loadImage(imgUrl: string): Promise<HTMLImageElement> {
  const image = getImage(imgUrl)
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = reject
  })
}

function drawImage(
  ctx: CanvasRenderingContext2D | null,
  image: HTMLImageElement,
  option: {
    x: number,
    y: number,
    gridX: number,
    gridY: number,
    allGridX: number,
    allGridY: number
    gridXSpan?: number
    gridYSpan?: number
  }
) {
  const {
    x,
    y,
    gridX = 1,
    gridY = 1,
    allGridX = 1,
    allGridY = 1,
    gridXSpan = 1,
    gridYSpan = 1
  } = option

  const width = image.width
  const height = image.height

  const unitX = width / allGridX
  const unitY = height / allGridY

  const drawWidth = unitX * gridXSpan
  const drawHeight = unitY * gridYSpan

  ctx?.drawImage(image, unitX * (gridX - 1), unitY * (gridY - 1), drawWidth, drawHeight, x, y, drawWidth, drawHeight)
}

/** load assets */
async function loadAssets() {
  const [heroImage, snowmenImage] = await Promise.all([loadImage(heroImg), loadImage(snowmenImg)] as const)

  return {
    heroImage,
    snowmenImage,
  }
}

class Controller {
  keys: Record<string, boolean> = {}
  private $el = document.createElement('div')

  lastUpdateTime = Date.now()
  deltaTime = 0

  ctx: CanvasRenderingContext2D

  activeObjects: Set<BaseObject> = new Set()

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
    window.addEventListener('keydown', this.handleKeyDown.bind(this))
    window.addEventListener('keyup', this.handleKeyUp.bind(this))
  }

  handleKeyDown(event: KeyboardEvent) {
    this.keys[event.key] = true

    console.log(this.keys)
  }

  handleKeyUp(event: KeyboardEvent) {
    delete this.keys[event.key]
  }

  isKeyDown(key: string) {
    return this.keys[key]
  }

  emit(eventName: string) {
    this.$el.dispatchEvent(new Event(eventName))
  }

  on(eventName: string, callback: (...args: any[]) => any) {
    this.$el.addEventListener(eventName, callback)
  }

  updateTime() {
    const now = Date.now()
    this.deltaTime = now - this.lastUpdateTime
    this.lastUpdateTime = now
  }

  detectGame(_hero: BaseObject) {
    return true
  }

  addObject(obj: BaseObject) {
    this.activeObjects.add(obj)
  }

  removeObject(obj: BaseObject) {
    this.activeObjects.delete(obj)
  }
}

class BaseObject {
  image: HTMLImageElement
  ctx: CanvasRenderingContext2D
  controller: Controller

  x = 0
  y = 0

  constructor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, controller: Controller) {
    this.ctx = ctx
    this.image = image
    this.controller = controller
  }

  setPosition(x: number, y: number) {
    this.x = x
    this.y = y
  }

}

class BaseGridObject extends BaseObject {
  gridX = 1
  gridY = 1
  allGridX = 3
  allGridY = 4
  gridXSpan = 1
  gridYSpan = 1

  constructor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, controller: Controller, allGridX: number, allGridY: number) {
    super(ctx, image, controller)
    this.allGridX = allGridX
    this.allGridY = allGridY
  }

  get width() {
    return this.image.width / this.allGridX * this.gridXSpan
  }

  get height() {
    return this.image.height / this.allGridY * this.gridYSpan
  }

  setPosition(x: number, y: number, lock = true) {
    if (lock) {
      super.setPosition(
        clamp(x, 0, this.ctx.canvas.width - this.width),
        clamp(y, 0, this.ctx.canvas.height - this.height)
      )
      return;
    }

    super.setPosition(x, y)
  }

  render() {
    drawImage(this.ctx, this.image, {
      x: this.x,
      y: this.y,
      gridX: this.gridX,
      gridY: this.gridY,
      allGridX: this.allGridX,
      allGridY: this.allGridY,
    })
  }

  setRandomPosition() {
    this.setPosition(
      (this.ctx.canvas.width - this.width) * Math.random(),
      (this.ctx.canvas.height - this.height) * Math.random()
    )

    return {
      x: this.x,
      y: this.y
    }
  }

  setCenterPosition() {
    this.setPosition(this.ctx.canvas.width / 2 + this.width / 2, this.ctx.canvas.height / 2 + this.height / 2)
  }
}

class Hero extends BaseGridObject {
  speed: number = 1920 / 2000

  constructor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, controller: Controller) {
    super(ctx, image, controller, 3, 4,)
    this.reset()
    this.controller.on('reset', this.reset.bind(this))
  }

  reset() {
    this.setCenterPosition()
  }

  upatePosition() {
    const deltaTime = this.controller.deltaTime
    let deltaPosX = 0
    let deltaPosY = 0

    if (this.controller.isKeyDown('ArrowLeft')) {
      deltaPosX = deltaTime * this.speed * -1
    }

    if (this.controller.isKeyDown('ArrowDown')) {
      deltaPosY = deltaTime * this.speed
    }

    if (this.controller.isKeyDown('ArrowRight')) {
      deltaPosX = deltaTime * this.speed
    }

    if (this.controller.isKeyDown('ArrowUp')) {
      deltaPosY = deltaTime * this.speed * -1
    }

    this.setPosition(this.x + deltaPosX, this.y + deltaPosY)
  }

  render() {
    this.upatePosition()
    super.render()
  }
}

class Snowmen extends BaseGridObject {
  resetDebounced: () => void

  constructor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, controller: Controller) {
    super(ctx, image, controller, 7, 3,)
    this.gridY = 3

    this.reset()

    this.controller.on('reset', this.reset.bind(this))

    this.resetDebounced = debounce(this.reset, 300)
  }

  reset() {
    this.setRandomPosition()
  }
}

class OnigokkoController extends Controller {
  constructor(ctx: CanvasRenderingContext2D) {
    super(ctx)
  }
}

function setControllerPanel(controller: Controller) {
  const resetButton = document.querySelector<HTMLButtonElement>('#button-reset')
  resetButton?.addEventListener('click', () => {
    controller.emit('reset')
  })

  const output = document.querySelector('.control-panel output')

  function setScore(count: number) {
    if (output) {
      output.innerHTML = `${count}`
    }
  }
  return {
    setScore
  }
}

async function main() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  const canvas = document.createElement('canvas')
  app.append(canvas)

  const meta = setCanvasMeta(canvas, {
    width: 1920,
    height: 1080,
    padding: 24
  })

  const ctx = canvas.getContext('2d')!

  /** load assets */
  const { heroImage, snowmenImage } = await loadAssets()

  const controller = new OnigokkoController(ctx)

  const hero = new Hero(ctx, heroImage, controller)
  const snowmen = new Snowmen(ctx, snowmenImage, controller)

  const panel = setControllerPanel(controller)

  controller.addObject(snowmen)

  let score = 0

  let timer = 0
  function setAuto() {
    timer = setInterval(() => {
      snowmen.reset()
    }, 5000)
  }


  function detectGame() {
    if (
      hero.x < (snowmen.x + snowmen.width) &&
      snowmen.x < (hero.x + hero.width) &&
      hero.y < (snowmen.y + snowmen.height) &&
      snowmen.y < (hero.y + hero.height)
    ) {
      // touch.
      clearInterval(timer)
      snowmen.reset()
      setAuto()
      score++
      panel.setScore(score)
      return
    }
  }



  function render() {
    controller.updateTime()

    ctx.clearRect(0, 0, meta.width, meta.height)
    snowmen.render()
    hero.render()

    detectGame()
    requestAnimationFrame(render)
  }

  render()
}

window.addEventListener('load', main, false)
