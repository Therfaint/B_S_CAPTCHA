const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const iPhone = devices['iPhone 6 Plus'];
let timeout = function(delay) {
   return new Promise((resolve, reject) => {
      setTimeout(() => {
         try {
            resolve(1);
         } catch (e) {
            reject(0);
         }
      }, delay);
   }).catch(() => console.log('catch'));
};

let page = null;
let btn_position = null;
let times = 0; // 执行重新滑动的次数
const distanceError = [-10, 2, 3, 5]; // 距离误差

async function run() {
   const browser = await puppeteer.launch({
      headless: false //这里我设置成false主要是为了让大家看到效果，设置为true就不会打开浏览器
   });
   page = await browser.newPage();
   
   await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
         get: () => false,
      });
      
      Object.defineProperty(navigator, 'plugins', {
         get: () => [1, 2, 3, 4, 5],
      });
      
      const originalQuery = window.navigator.permissions.query;
      return window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
              Promise.resolve({state: Notification.permission}) :
              originalQuery(parameters)
      );
   });
   
   // 1.打开前端页面
   await page.emulate({
      viewport: {width: 1280, height: 748, isMobile: false},
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
   });
   await page.goto('https://xue.tongdun.cn/');
   await timeout(1000);
   
   // 2.打开登录页面
   page.click('.pull-right.btn-group ul li');
   await timeout(1000);
   
   // 3.输入账号密码
   page.type('#account', '15968813971');
   await timeout(500);
   page.type('#password', 'tianxin19941126');
   await timeout(1000);
   
   // 4.点击验证
   page.click('#loginBtn');
   await timeout(1000);
   
   while (await page.evaluate(() => {
      return document.querySelector('.td-pop-slide-identity') ? false : true;
   })) {
      page.click('.td-icon-close');
      await timeout(1500);
      page.click('#loginBtn');
      await timeout(500);
      console.log('looping');
   }
   
   btn_position = await getBtnPosition();
   
   await timeout(1000);
   // console.log(await calculateDistance())
   
   // 5.滑动
   drag(null);
}

/**
 * 计算按钮需要滑动的距离
 * */
async function calculateDistance() {
   const distance = await page.evaluate(() => {
      const ctx = document.querySelector('.td-bg-img'); // 背景图片
      const pixelDifference = 50; // 像素差 TODO 2.November lower the throttle (basic 60), collect more data then using filter
      let res = []; // 像素差图 manual calculate the second dimension
      // 对比像素
      // yAxis 180 points
      for (let j = 0; j < 180; j++) {
         let lastPixel = null;
         // xAxis 260 points
         for (let i = 59; i < 320; i++) {
            const imgData = ctx.getContext('2d').
                getImageData(1 * i, 1 * j, 1, 1);
            const data = imgData.data;
            const r = data[0];
            const g = data[1];
            const b = data[2];
            const currentPixel = {
               r,
               g,
               b,
            };
            if (lastPixel) {
               if (Math.abs(currentPixel.r - lastPixel.r) > pixelDifference &&
                   Math.abs(currentPixel.g - lastPixel.g) > pixelDifference &&
                   Math.abs(currentPixel.b - lastPixel.b) > pixelDifference) {
                  res.push(true);
               } else {
                  res.push(false);
               }
               lastPixel = currentPixel;
            } else {
               lastPixel = currentPixel;
            }
         }
      }
      return res;
   });
   // origin algorithm
   // let c = {}, xAxis;
   // distance.map((val, index)=>{
   //   if(val === true){
   //     let x = index % 260;
   //     if(c.hasOwnProperty(x)){
   //       c[x] += 1;
   //     }else{
   //       c[x] = 0
   //     }
   //   }
   // })
   // Object.keys(c).map(item=>{
   //   if(xAxis){
   //     if(c[item] > c[xAxis]){
   //       xAxis = item;
   //     }
   //   }else{
   //     xAxis = item;
   //   }
   // })
   // let zleftX = xAxis - 42;
   // if(c.hasOwnProperty(zleftX) && c[zleftX] >= 10){
   //   xAxis = zleftX;
   // }
   
   // updated algorithm
   let c = {}, xAxis = 0;
   distance.map((val, index) => {
      if (val === true) {
         let x = index % 260;
         if (c.hasOwnProperty(x)) {
            c[x] += 1;
         } else {
            c[x] = 0;
         }
      }
   });
   let top5 = [];
   Object.keys(c).map(item => {
      // TODO 2.November filter data here! maybe useful .. try it out!
      if (c[item] > 42 || c[item] < 20) {
         return;
      }
      if (top5.length === 0) {
         top5.push(item);
      } else {
         if (top5.length < 5) {
            if (c[top5[top5.length - 1]] > c[item]) {
               top5.unshift(item);
            } else {
               top5.push(item);
            }
         } else {
            for (let i = 0; i < 5; i++) {
               if (c[item] >= c[top5[i]]) {
                  for (let j = 4; j > i; j--) {
                     top5[j] = top5[j - 1];
                  }
                  top5[i] = item;
                  break;
               }
            }
         }
      }
   });
   for (let ii = 0; ii < 5; ii++) {
      for (let jj = 0; jj < 5; jj++) {
         if (Math.abs(top5[ii] - top5[jj]) <= 42 &&
             Math.abs(top5[ii] - top5[jj]) >= 35) {
            xAxis = Number(
                parseInt(top5[ii]) > parseInt(top5[jj]) ? top5[jj] : top5[ii]);// according to the stats, plus one is more accurate
            break;
         }
      }
   }
   console.log(JSON.stringify(top5), xAxis);
   if (xAxis === 0) {
      if (c[`${top5[0] - 42}`] > 10) {
         xAxis = top5[0] - 40; // It should be minus 42, but according to the stats, I modify it, too
      } else {
         xAxis = top5[0];
      }
   }
   return Number(xAxis) + 59;
}

/**
 * 计算滑块位置
 */
async function getBtnPosition() {
   const btn_position = await page.evaluate(() => {
      const wrapper = document.querySelector('.td-pop-cnt'),
          sliderBar = document.querySelector('.td-slide-wrap');
      const wLeft = wrapper.offsetLeft, wTop = wrapper.offsetTop,
          sLeft = sliderBar.offsetLeft, sTop = sliderBar.offsetTop;
      return {btn_left: 500, btn_top: 464, wLeft, wTop};
   });
   // TODO calculate position of the slider. PS: I don't know why but I just can't get the right
   return btn_position;
}

/**
 * 尝试滑动按钮
 * @param distance 滑动距离
 * */
async function tryValidation(distance) {
   const piece = 10, fragments = {};
   //将距离拆分成两段，模拟正常人的行为
   
   const base = distance / piece;
   for (let i = 0; i < piece; i = i + 2) {
      // const increment = Math.floor(Math.random() * 2);
      fragments[`p${i}`] = {
         addon: base * (i + 1),
         steps: Math.floor(Math.random() * 10 + 30),
      };
      fragments[`p${i + 1}`] = {
         addon: base * (i + 2),
         steps: Math.floor(Math.random() * 10 + 30),
      };
      // fragments[`p${i}`] = {addon: base * (i+1), steps: Math.floor(Math.random() * 100 - 20)}
      // fragments[`p${i+1}`] = {addon: base * (i+2), steps: Math.floor(Math.random() * 100 - 20)}
   }
   
   // drag
   page.mouse.move(btn_position.btn_left, btn_position.btn_top);
   page.mouse.down();
   for (let k in fragments) {
      page.mouse.move(btn_position.btn_left + fragments[k].addon,
          btn_position.btn_top, {steps: fragments[k].steps});
      await timeout(33);
   }
   await timeout(800);
   page.mouse.move(btn_position.btn_left + distance + 9, btn_position.btn_top,
       {steps: 9}); // over slide
   await timeout(800);
   page.mouse.move(btn_position.btn_left + distance, btn_position.btn_top,
       {steps: 20}); // rollback
   await timeout(800);
   page.mouse.up();
   
   await timeout(111);
   
   // 判断是否验证成功
   const isSuccess = await page.evaluate(() => {
      return document.querySelector('.td-pop-slide-msg') &&
          document.querySelector('.td-pop-slide-msg').innerText;
   });
   console.log(isSuccess);
   return {
      isSuccess: isSuccess === '验证成功',
   };
}

/**
 * 拖动滑块
 * @param distance 滑动距离
 * */
async function drag() {
   let distance = await calculateDistance();
   const result = await tryValidation(distance);
   // await tryValidation(250);
   if (result.isSuccess) {
      //登录
      console.log('验证成功');
   } else {
      console.log('重新计算滑距离录，重新滑动');
      times = 0;
      await drag(null);
   }
}

run();
