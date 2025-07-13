import { auth, provider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { db, addCarData, removeCarData, getCarData } from './firebase.js';
import { storage, uploadFile } from './firebase.js';

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const userInfo = document.getElementById('user-info');
const googleLoginBtn = document.getElementById('google-login');
const emailLoginBtn = document.getElementById('email-login');
const emailSignupBtn = document.getElementById('email-signup');
const carList = document.getElementById('car-list');
const addCarBtn = document.getElementById('add-car');

// 임시 차량 데이터 (Firebase 연동 전)
let cars = [
  { id: 1, name: 'Hyundai i30', emoji: '🚙' },
  { id: 2, name: 'Kia Carnival', emoji: '🚐' }
];

function renderCarList() {
  carList.innerHTML = '';
  cars.forEach(car => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="emoji">${car.emoji}</span> ${car.name} <button class="btn" onclick="removeCar(${car.id})">삭제</button>`;
    li.style.cursor = 'pointer';
    li.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return; // 삭제 버튼 클릭시 무시
      showCarDetail(car);
    };
    carList.appendChild(li);
  });
}

window.removeCar = function(id) {
  cars = cars.filter(car => car.id !== id);
  renderCarList();
};

addCarBtn.addEventListener('click', () => {
  const name = prompt('차량 이름을 입력하세요!');
  if (name) {
    const emoji = prompt('차량 이모티콘(예: 🚗, 🚙, 🚐, 🛻)을 입력하세요!', '🚗');
    cars.push({ id: Date.now(), name, emoji: emoji || '🚗' });
    renderCarList();
  }
});

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
      return `<li>${m.date} - ${m.desc}${urgent} <button class='btn' onclick='removeMaint("${key}")'>삭제</button></li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-maint-btn'>정비 추가</button>
    <div style='font-size:0.95em;color:#888;margin-top:0.5em;'>만기 30일 이내 항목은 <span style='color:red;'>강조</span>됩니다.<br>이메일 알림은 추후 설정에서 활성화할 수 있습니다.</div>`;
  document.getElementById('add-maint-btn').onclick = async () => {
    const date = prompt('정비 날짜(YYYY-MM-DD)');
    const desc = prompt('정비 내용');
    if (date && desc) {
      await addCarData(currentUser.uid, currentCar.id, 'maintenances', { date, desc });
    }
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
      return `<li>${i.type}: ${i.expire}${urgent} <button class='btn' onclick='removeInsurance("${key}")'>삭제</button></li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-insurance-btn'>보험 추가</button>
    <div style='font-size:0.95em;color:#888;margin-top:0.5em;'>만기 30일 이내 항목은 <span style='color:red;'>강조</span>됩니다.<br>이메일 알림은 추후 설정에서 활성화할 수 있습니다.</div>`;
  document.getElementById('add-insurance-btn').onclick = async () => {
    const type = prompt('보험 종류 (예: Rego, Green Slip)');
    const expire = prompt('만기일 (YYYY-MM-DD)');
    if (type && expire) {
      await addCarData(currentUser.uid, currentCar.id, 'insurances', { type, expire });
    }
  };
}
window.removeInsurance = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'insurances', key);
};

// 사고 탭
function renderAccidentTab(data) {
  const accident = document.getElementById('accident');
  accident.innerHTML = `<h3>사고 기록</h3>
    <ul>${Object.entries(data).map(([key, a])=>`<li>${a.date} - ${a.desc} ${a.address ? `<br><span style='font-size:0.95em;'>📍${a.address}</span><br><img src='https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(a.address)}&zoom=16&size=200x100&markers=color:red|${encodeURIComponent(a.address)}&key=AIzaSyB396sXp7Qo8oIkwm6ASc-qgL_2IhpDBR8' style='width:200px;border-radius:7px;margin:4px 0;'/>` : ''} ${a.photo ? `<img src='${a.photo}' style='height:40px;vertical-align:middle;border-radius:5px;margin-left:8px;'/>` : ''} <button class='btn' onclick='removeAccident("${key}")'>삭제</button></li>`).join('')}</ul>
    <button class='btn blue' id='add-accident-btn'>사고 추가</button>
    <input type='file' id='accident-photo' accept='image/*' style='display:none;'>`;
  document.getElementById('add-accident-btn').onclick = async () => {
    const date = prompt('사고 날짜(YYYY-MM-DD)');
    const desc = prompt('사고 내용');
    const address = prompt('사고 위치(주소, 예: 123 Main St, Sydney)');
    const fileInput = document.getElementById('accident-photo');
    fileInput.value = '';
    fileInput.click();
    fileInput.onchange = async () => {
      let photoUrl = '';
      if (fileInput.files[0]) {
        const path = `users/${currentUser.uid}/cars/${currentCar.id}/accidents/${Date.now()}_${fileInput.files[0].name}`;
        photoUrl = await uploadFile(path, fileInput.files[0]);
      }
      if (date && desc) {
        await addCarData(currentUser.uid, currentCar.id, 'accidents', { date, desc, address, photo: photoUrl });
      }
    };
    setTimeout(() => {
      if (!fileInput.files[0] && date && desc) {
        addCarData(currentUser.uid, currentCar.id, 'accidents', { date, desc, address, photo: '' });
      }
    }, 2000);
  };
}
window.removeAccident = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'accidents', key);
};

// 문서 탭
function renderDocsTab(data) {
  const docs = document.getElementById('docs');
  docs.innerHTML = `<h3>문서 관리</h3>
    <ul>${Object.entries(data).map(([key, d])=>`<li>${d.name} ${d.photo ? `<img src='${d.photo}' style='height:40px;vertical-align:middle;border-radius:5px;margin-left:8px;'/>` : ''} <button class='btn' onclick='removeDoc("${key}")'>삭제</button></li>`).join('')}</ul>
    <button class='btn blue' id='add-doc-btn'>문서 추가</button>
    <input type='file' id='doc-photo' accept='image/*,application/pdf' style='display:none;'>`;
  document.getElementById('add-doc-btn').onclick = async () => {
    const name = prompt('문서 이름');
    const fileInput = document.getElementById('doc-photo');
    fileInput.value = '';
    fileInput.click();
    fileInput.onchange = async () => {
      let photoUrl = '';
      if (fileInput.files[0]) {
        const path = `users/${currentUser.uid}/cars/${currentCar.id}/documents/${Date.now()}_${fileInput.files[0].name}`;
        photoUrl = await uploadFile(path, fileInput.files[0]);
      }
      if (name) {
        await addCarData(currentUser.uid, currentCar.id, 'documents', { name, photo: photoUrl });
      }
    };
    setTimeout(() => {
      if (!fileInput.files[0] && name) {
        addCarData(currentUser.uid, currentCar.id, 'documents', { name, photo: '' });
      }
    }, 2000);
  };
}
window.removeDoc = async function(key) {
  await removeCarData(currentUser.uid, currentCar.id, 'documents', key);
};

// 로그인/로그아웃 UI 처리
function showApp(user) {
  loginSection.style.display = 'none';
  appSection.style.display = 'block';
  userInfo.innerHTML = `<span class="emoji">👤</span> ${user.displayName || user.email} <button class="btn" id="logout-btn">로그아웃</button>`;
  renderCarList();
  document.getElementById('logout-btn').onclick = () => signOut(auth);
}
function showLogin() {
  loginSection.style.display = 'block';
  appSection.style.display = 'none';
  userInfo.innerHTML = '';
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
    showApp(user);
  } else {
    currentUser = null;
    showLogin();
  }
});