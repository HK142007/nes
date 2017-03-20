import CPU from './proc/CPU';
import APU from './audio/APU';
import PPU from './video/PPU';
import DMA from './memory/DMA';
import CPUMemory from './memory/CPUMemory';
import PPUMemory from './memory/PPUMemory';
import {RESET} from './proc/interrupts';
import {createMapper} from './memory/mappers';
import {packColor, BLACK_COLOR} from './video/colors';
import Region from './common/Region';
import log from './common/log';

export default class NES {

  constructor(units = {}) {
    log.info('Initializing NES');
    this.initUnits(units);
    this.connectUnits();
    this.updateRegionParams();
  }

  //=========================================================
  // Units
  //=========================================================

  initUnits(units) {
    this.cpu = units.cpu || new CPU;
    this.ppu = units.ppu || new PPU;
    this.apu = units.apu || new APU;
    this.dma = units.dma || new DMA;
    this.cpuMemory = units.cpuMemory || new CPUMemory;
    this.ppuMemory = units.ppuMemory || new PPUMemory;
  }

  connectUnits() {
    this.cpu.connect(this);
    this.ppu.connect(this);
    this.apu.connect(this);
    this.dma.connect(this);
    this.cpuMemory.connect(this);
    this.ppuMemory.connect(this);
  }

  resetUnits() {
    this.cpuMemory.reset();
    this.ppuMemory.reset();
    this.mapper.reset(); // Must be done after memory
    this.ppu.reset();
    this.apu.reset();
    this.dma.reset();
    this.cpu.reset(); // Must be done last
  }

  //=========================================================
  // Region
  //=========================================================

  setRegion(region) {
    this.region = region;
    this.updateRegionParams();
  }

  getRegion() {
    return this.region || null;
  }

  getUsedRegion() {
    return this.region || (this.cartridge && this.cartridge.region) || Region.NTSC;
  }

  updateRegionParams() {
    log.info('Updating region parameters');
    const region = this.getUsedRegion();
    const params = Region.getParams(region);
    log.info(`Detected region: "${region}"`);
    this.ppu.setRegionParams(params);
    this.apu.setRegionParams(params);
  }

  //=========================================================
  // Cartridge
  //=========================================================

  setCartridge(cartridge) {
    if (this.cartridge) {
      log.info('Removing current cartridge');
      this.mapper.disconnect();
      this.mapper = null;
      this.cartridge = null;
    }
    if (cartridge) {
      log.info('Inserting cartridge');
      this.cartridge = cartridge;
      this.mapper = createMapper(cartridge);
      this.mapper.connect(this);
      this.updateRegionParams();
      this.power();
    }
  }

  getCartridge() {
    return this.cartridge || null;
  }

  //=========================================================
  // Reset
  //=========================================================

  power() {
    if (this.cartridge) {
      this.resetUnits();
    }
  }

  reset() {
    this.cpu.activateInterrupt(RESET);
  }

  //=========================================================
  // Input devices
  //=========================================================

  setInputDevice(port, device) {
    const prevDevice = this.cpuMemory.getInputDevice(port);
    if (prevDevice) {
      prevDevice.disconnect();
    }
    this.cpuMemory.setInputDevice(port, device);
    if (device) {
      device.connect(this);
    }
  }

  getInputDevice(port) {
    return this.cpuMemory.getInputDevice(port);
  }

  //=========================================================
  // Video output
  //=========================================================

  setPalette(palette) {
    this.ppu.setBasePalette(palette);
  }

  getPalette() {
    return this.ppu.getBasePalette();
  }

  renderFrame(buffer) {
    if (this.cartridge) {
      this.renderNormalFrame(buffer);
    } else {
      this.renderEmptyFrame(buffer);
    }
  }

  renderNormalFrame(buffer) {
    this.ppu.setFrameBuffer(buffer);
    while (!this.ppu.isFrameAvailable()) {
      this.cpu.step();
    }
  }

  renderEmptyFrame(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      const color = ~~(0xFF * Math.random());
      buffer[i] = packColor(color, color, color);
    }
  }

  renderDebugFrame(buffer) {
    if (this.cartridge) {
      this.renderNormalDebugFrame(buffer);
    } else {
      this.renderEmptyDebugFrame(buffer);
    }
  }

  renderNormalDebugFrame(buffer) {
    this.ppu.setFrameBuffer(buffer);
    this.ppu.renderDebugFrame();
  }

  renderEmptyDebugFrame(buffer) {
    buffer.fill(BLACK_COLOR);
  }

  //=========================================================
  // Audio output
  //=========================================================

  setAudioEnabled(enabled) {
    this.apu.setOutputEnabled(enabled);
  }

  isAudioEnabled() {
    return this.apu.isOutputEnabled();
  }

  setAudioBufferSize(size) {
    this.apu.setBufferSize(size);
  }

  getAudioBufferSize() {
    return this.apu.getBufferSize();
  }

  setAudioSampleRate(rate) {
    this.apu.setSampleRate(rate);
  }

  getAudioSampleRate() {
    return this.apu.getSampleRate();
  }

  setAudioChannelVolume(id, volume) {
    this.apu.setChannelVolume(id, volume);
  }

  getAudioChannelVolume(id) {
    return this.apu.getChannelVolume(id);
  }

  readAudioBuffer() {
    return this.apu.readBuffer();
  }

  //=========================================================
  // Non-volatile RAM
  //=========================================================

  getNVRAM() {
    return this.mapper ? this.mapper.getNVRAM() : null;
  }

}