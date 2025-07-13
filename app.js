import { auth, provider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { db, addCarData, removeCarData, getCarData } from './firebase.js';
import { storage, uploadFile } from './firebase.js';
import { ref as dbRef, push as dbPush, set as dbSet, remove as dbRemove, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const ADMIN_EMAILS = ['nayajcsong@gmail.com', 'jknetwork001@gmail.com'];

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const userInfo = document.getElementById('user-info');
const googleLoginBtn = document.getElementById('google-login');
const emailLoginBtn = document.getElementById('email-login');
const emailSignupBtn = document.getElementById('email-signup');
const carList = document.getElementById('car-list');
const addCarBtn = document.getElementById('add-car');

// 임시 차량 데이터 (Firebase 연동 전)
let cars = [];

function renderCarList() {
  carList.innerHTML = '';
  cars.forEach(car => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="emoji">${car.emoji}</span> ${car.name} <button class="btn" onclick="removeCar('${car.id}')">삭제</button>`;
    li.style.cursor = 'pointer';
    li.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return; // 삭제 버튼 클릭시 무시
      showCarDetail(car);
    };
    carList.appendChild(li);
  });
}

// DB에서 차량 목록 불러오기
function loadCarsFromDB() {
  const carsRef = dbRef(db, 'companyCars');
  onValue(carsRef, (snapshot) => {
    const val = snapshot.val() || {};
    cars = Object.entries(val).map(([id, car]) => ({ id, ...car }));
    renderCarList();
  });
}

// 차량 추가
addCarBtn.addEventListener('click', () => {
  const name = prompt('차량 이름을 입력하세요!');
  if (name) {
    const emoji = prompt('차량 이모티콘(예: 🚗, 🚙, 🚐, 🛻)을 입력하세요!', '🚗');
    const newCar = { name, emoji: emoji || '🚗' };
    const carsRef = dbRef(db, 'companyCars');
    dbPush(carsRef, newCar);
  }
});

// 차량 삭제
window.removeCar = function(id) {
  const carRef = dbRef(db, `companyCars/${id}`);
  dbRemove(carRef);
};

let currentUser = null;
let currentCar = null;

// 차량 클릭 시 상세 정보 표시 및 DB 연동
function showCarDetail(car) {
  currentCar = car;
  const carDetail = document.getElementById('car-detail');
  carDetail.style.display = 'block';

  // 각 탭별 데이터 불러오기
  if (currentUser) {
    getCarData(currentUser.uid, car.id, 'maintenances', (data) => renderMaintTab(data));
    getCarData(currentUser.uid, car.id, 'insurances', (data) => renderInsuranceTab(data));
    getCarData(currentUser.uid, car.id, 'accidents', (data) => renderAccidentTab(data));
    getCarData(currentUser.uid, car.id, 'documents', (data) => renderDocsTab(data));
  }

  // 탭 전환 기능 (기존 코드 유지)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.onclick = function() {
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(tab=>tab.style.display='none');
      document.getElementById(this.dataset.tab).style.display = 'block';
    };
  });
  document.querySelector('.tab-btn[data-tab="maint"]').classList.add('active');
  document.getElementById('maint').style.display = 'block';
  document.getElementById('insurance').style.display = 'none';
  document.getElementById('accident').style.display = 'none';
  document.getElementById('docs').style.display = 'none';
}

function daysLeft(dateStr) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}
// 정비 탭 렌더링 및 추가/삭제
function renderMaintTab(data) {
  const maint = document.getElementById('maint');
  maint.innerHTML = `<h3>정비 내역</h3>
    <ul>${Object.entries(data).map(([key, m])=>{
      const d = daysLeft(m.date);
      const urgent = d <= 30 ? ` <span style='color:red;font-weight:bold;'>⚠️ ${d}일 남음</span>` : '';
      return `<li>${m.date} <b>[${m.type||'기타'}]</b> - ${m.desc} <span style='color:#1976d2;'>${m.cost ? m.cost+'원' : ''}</span>${urgent} <button class='btn' onclick='removeMaint("${key}")'>삭제</button></li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-maint-btn'>정비 추가</button>
    <div style='font-size:0.95em;color:#888;margin-top:0.5em;'>만기 30일 이내 항목은 <span style='color:red;'>강조</span>됩니다.<br>이메일 알림은 추후 설정에서 활성화할 수 있습니다.</div>`;
  document.getElementById('add-maint-btn').onclick = () => {
    document.getElementById('maint-modal').style.display = 'flex';
  };
  document.getElementById('maint-cancel').onclick = () => {
    document.getElementById('maint-modal').style.display = 'none';
  };
  document.getElementById('maint-save').onclick = async () => {
    const date = document.getElementById('maint-date').value;
    const type = document.getElementById('maint-type').value;
    const cost = document.getElementById('maint-cost').value;
    const desc = document.getElementById('maint-desc').value;
    if (!date || !desc) {
      alert('날짜와 내용을 입력하세요!');
      return;
    }
    await addCarData(currentUser.uid, currentCar.id, 'maintenances', { date, type, cost, desc });
    document.getElementById('maint-modal').style.display = 'none';
    // 입력값 초기화
    document.getElementById('maint-date').value = '';
    document.getElementById('maint-type').value = '정기점검';
    document.getElementById('maint-cost').value = '';
    document.getElementById('maint-desc').value = '';
  };
}
window.removeMaint = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'maintenances', key);
};

// 보험 탭
function renderInsuranceTab(data) {
  const insurance = document.getElementById('insurance');
  insurance.innerHTML = `<h3>보험/등록</h3>
    <ul>${Object.entries(data).map(([key, i])=>{
      const d = daysLeft(i.expire);
      const urgent = d <= 30 ? ` <span style='color:red;font-weight:bold;'>⚠️ ${d}일 남음</span>` : '';
      return `<li><b>[${i.type||'종합보험'}]</b> ${i.expire}${urgent} <button class='btn' onclick='removeInsurance("${key}")'>삭제</button></li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-insurance-btn'>보험 추가</button>
    <div style='font-size:0.95em;color:#888;margin-top:0.5em;'>만기 30일 이내 항목은 <span style='color:red;'>강조</span>됩니다.<br>이메일 알림은 추후 설정에서 활성화할 수 있습니다.</div>`;
  document.getElementById('add-insurance-btn').onclick = () => {
    document.getElementById('insurance-modal').style.display = 'flex';
  };
  document.getElementById('insurance-cancel').onclick = () => {
    document.getElementById('insurance-modal').style.display = 'none';
  };
  document.getElementById('insurance-save').onclick = async () => {
    const type = document.getElementById('insurance-type').value;
    const expire = document.getElementById('insurance-expire').value;
    if (!type || !expire) {
      alert('보험 종류와 만기일을 입력하세요!');
      return;
    }
    await addCarData(currentUser.uid, currentCar.id, 'insurances', { type, expire });
    document.getElementById('insurance-modal').style.display = 'none';
    // 입력값 초기화
    document.getElementById('insurance-type').value = '종합보험';
    document.getElementById('insurance-expire').value = '';
  };
}
window.removeInsurance = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'insurances', key);
};

// 사고 탭
function renderAccidentTab(data) {
  const accident = document.getElementById('accident');
  accident.innerHTML = `<h3>사고 기록</h3>
    <ul>${Object.entries(data).map(([key, a])=>
      `<li>
        <b>${a.date||''}</b> - ${a.desc||''}<br>
        <span style='font-size:0.95em;'>우리측: ${a.myName||''} (${a.myPhone||''})<br>상대: ${a.otherName||''} (${a.otherPhone||''})</span><br>
        ${a.otherAddr ? `<span style='font-size:0.95em;'>상대 주소: ${a.otherAddr}</span><br>` : ''}
        ${a.otherLicense ? `<img src='${a.otherLicense}' class='preview' title='면허증'/>` : ''}
        ${a.carPhotos ? a.carPhotos.map(url=>`<img src='${url}' class='preview' title='사고차량'/>`).join('') : ''}
        ${a.address ? `<br><span style='font-size:0.95em;'>📍${a.address}</span><br><img src='https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(a.address)}&zoom=16&size=200x100&markers=color:red|${encodeURIComponent(a.address)}&key=AIzaSyB396sXp7Qo8oIkwm6ASc-qgL_2IhpDBR8'/>` : ''}
        <button class='btn' onclick='removeAccident("${key}")'>삭제</button>
      </li>`
    ).join('')}</ul>
    <button class='btn blue' id='add-accident-btn'>사고 추가</button>`;
  document.getElementById('add-accident-btn').onclick = () => {
    document.getElementById('accident-modal').style.display = 'flex';
  };
  document.getElementById('accident-cancel').onclick = () => {
    document.getElementById('accident-modal').style.display = 'none';
  };
  // 지도 미리보기
  document.getElementById('acc-address').oninput = function() {
    const addr = this.value;
    const mapDiv = document.getElementById('acc-map-preview');
    if (addr) {
      mapDiv.innerHTML = `<img src='https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(addr)}&zoom=16&size=200x100&markers=color:red|${encodeURIComponent(addr)}&key=AIzaSyB396sXp7Qo8oIkwm6ASc-qgL_2IhpDBR8'/>`;
    } else {
      mapDiv.innerHTML = '';
    }
  };
  // 사진 미리보기
  document.getElementById('acc-other-license').onchange = function() {
    const file = this.files[0];
    const preview = this.parentNode;
    if (file) {
      const url = URL.createObjectURL(file);
      if (!preview.querySelector('img')) {
        const img = document.createElement('img');
        img.className = 'preview';
        img.src = url;
        preview.appendChild(img);
      } else {
        preview.querySelector('img').src = url;
      }
    }
  };
  document.getElementById('acc-car-photos').onchange = function() {
    const files = Array.from(this.files).slice(0,10);
    const preview = this.parentNode;
    // 기존 미리보기 삭제
    preview.querySelectorAll('img.preview').forEach(img=>img.remove());
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.className = 'preview';
      img.src = url;
      preview.appendChild(img);
    });
  };
  document.getElementById('accident-save').onclick = async () => {
    const myName = document.getElementById('acc-my-name').value;
    const myPhone = document.getElementById('acc-my-phone').value;
    const otherName = document.getElementById('acc-other-name').value;
    const otherPhone = document.getElementById('acc-other-phone').value;
    const otherAddr = document.getElementById('acc-other-addr').value;
    const desc = document.getElementById('acc-desc').value;
    const address = document.getElementById('acc-address').value;
    const date = new Date().toISOString().slice(0,10);
    // 사진 업로드
    let otherLicenseUrl = '';
    const otherLicenseFile = document.getElementById('acc-other-license').files[0];
    if (otherLicenseFile) {
      const path = `users/${currentUser.uid}/cars/${currentCar.id}/accidents/${Date.now()}_license.jpg`;
      otherLicenseUrl = await uploadFile(path, otherLicenseFile);
    }
    let carPhotosUrls = [];
    const carPhotoFiles = Array.from(document.getElementById('acc-car-photos').files).slice(0,10);
    for (let i=0; i<carPhotoFiles.length; i++) {
      const path = `users/${currentUser.uid}/cars/${currentCar.id}/accidents/${Date.now()}_car_${i}.jpg`;
      const url = await uploadFile(path, carPhotoFiles[i]);
      carPhotosUrls.push(url);
    }
    await addCarData(currentUser.uid, currentCar.id, 'accidents', {
      myName, myPhone, otherName, otherPhone, otherAddr, otherLicense: otherLicenseUrl, carPhotos: carPhotosUrls, desc, address, date
    });
    document.getElementById('accident-modal').style.display = 'none';
    // 입력값 초기화
    [
      'acc-my-name','acc-my-phone','acc-other-name','acc-other-phone','acc-other-addr','acc-desc','acc-address'
    ].forEach(id=>document.getElementById(id).value='');
    document.getElementById('acc-other-license').value = '';
    document.getElementById('acc-car-photos').value = '';
    document.getElementById('acc-map-preview').innerHTML = '';
    document.querySelectorAll('#acc-other-license + img, #acc-car-photos + img').forEach(img=>img.remove());
  };
}
window.removeAccident = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'accidents', key);
};

// 문서 탭
function renderDocsTab(data) {
  const docs = document.getElementById('docs');
  docs.innerHTML = `<h3>문서 관리</h3>
    <ul>${Object.entries(data).map(([key, d])=> {
      const isAdmin = currentUser && ADMIN_EMAILS.includes(currentUser.email);
      const isOwner = d.uploader && (d.uploader === (currentUser.displayName || currentUser.email));
      return `<li>
        ${d.file ? `<a href='${d.file}' target='_blank'>문서보기</a> ` : ''}
        ${d.expire ? `<span style='color:#1976d2;'>만기: ${d.expire}</span> ` : ''}
        ${d.uploader ? `<span style='font-size:0.95em;color:#888;'>by ${d.uploader}</span>` : ''}
        ${(isAdmin || isOwner) ? `<button class='btn' onclick='removeDoc("${key}")'>삭제</button>` : ''}
      </li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-doc-btn'>문서 추가</button>`;
  document.getElementById('add-doc-btn').onclick = () => {
    document.getElementById('doc-modal').style.display = 'flex';
  };
  document.getElementById('doc-cancel').onclick = () => {
    document.getElementById('doc-modal').style.display = 'none';
  };
  document.getElementById('doc-save').onclick = async () => {
    const fileInput = document.getElementById('doc-file');
    const expire = document.getElementById('doc-expire').value;
    let fileUrl = '';
    if (fileInput.files[0]) {
      const path = `users/${currentUser.uid}/cars/${currentCar.id}/documents/${Date.now()}_${fileInput.files[0].name}`;
      fileUrl = await uploadFile(path, fileInput.files[0]);
    }
    const uploader = currentUser.displayName || currentUser.email || 'Unknown';
    await addCarData(currentUser.uid, currentCar.id, 'documents', { file: fileUrl, expire, uploader });
    document.getElementById('doc-modal').style.display = 'none';
    fileInput.value = '';
    document.getElementById('doc-expire').value = '';
  };
}
window.removeDoc = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'documents', key);
};

// 로그인/로그아웃 UI 처리
// 로그인 후 차량 목록 불러오기
function showApp(user) {
  loginSection.style.display = 'none';
  appSection.style.display = 'block';
  userInfo.innerHTML = `<span class="emoji">👤</span> ${user.displayName || user.email} <button class="btn" id="logout-btn">로그아웃</button>`;
  loadCarsFromDB();
  document.getElementById('logout-btn').onclick = () => signOut(auth);
}
function showLogin() {
  loginSection.style.display = 'block';
  appSection.style.display = 'none';
  userInfo.innerHTML = '';
}

// 접속 로그 기록
function logUserLogin(user) {
  const logRef = dbRef(db, `users/${user.uid}/logs`);
  dbPush(logRef, {
    time: new Date().toISOString(),
    email: user.email,
    displayName: user.displayName || '',
    action: 'login'
  });
}

googleLoginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    alert('구글 로그인 실패: ' + e.message);
  }
});

emailLoginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert('이메일 로그인 실패: ' + e.message);
  }
});

emailSignupBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert('회원가입 성공! 이제 로그인하세요.');
  } catch (e) {
    alert('회원가입 실패: ' + e.message);
  }
});

// 로그인 상태 감지 시 currentUser 저장
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    logUserLogin(user);
    showApp(user);
  } else {
    currentUser = null;
    showLogin();
  }
});