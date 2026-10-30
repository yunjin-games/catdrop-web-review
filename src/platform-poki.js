import config from './config.js';
const SAVE_KEY='catdrop.web.v1';
export class PokiPlatform {
  constructor(){this.sdk=null;this.playing=false;this.busy=false;this.storageFailed=false;this.loadingFinished=false;this.onMute=()=>{};this.onBusy=()=>{};}
  async init(){
    try{
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script'),timer=setTimeout(()=>reject(new Error('SDK timeout')),8000);
        script.src='https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
        script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(new Error('SDK unavailable'));};document.head.append(script);
      });
      const sdk=window.PokiSDK;
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('SDK timeout')),8000);
        Promise.resolve(sdk.init()).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
      });this.sdk=sdk;
    }catch{this.sdk=null;} // The game remains playable without advertising.
  }
  get language(){try{return this.sdk?.getLanguage();}catch{return null;}}
  get forcedMute(){return false;}
  read(){try{return window.localStorage.getItem(SAVE_KEY);}catch{this.storageFailed=true;return null;}}
  write(value){try{window.localStorage.setItem(SAVE_KEY,value);return true;}catch{this.storageFailed=true;return false;}}
  start(){if(this.busy||this.playing)return;try{this.sdk?.gameplayStart();}catch{}this.playing=true;}
  stop(){if(this.busy||!this.playing)return;try{this.sdk?.gameplayStop();}catch{}this.playing=false;}
  loading(active){if(this.busy||active||this.loadingFinished)return;try{this.sdk?.gameLoadingFinished();}catch{}this.loadingFinished=true;}
  get canReward(){return config.ads&&!!this.sdk&&!this.busy;}
  async ad(type){
    if(!this.canReward)return false;
    this.stop();this.busy=true;this.onBusy(true);this.onMute(true);
    try{
      if(type==='rewarded')return (await this.sdk.rewardedBreak(()=>this.onMute(true)))===true;
      await this.sdk.commercialBreak(()=>this.onMute(true));return true;
    }catch{return false;}
    finally{this.busy=false;this.onMute(false);this.onBusy(false);}
  }
}
