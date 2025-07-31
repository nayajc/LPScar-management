import { auth, provider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { db, addCarData, removeCarData, getCarData } from './firebase.js';
import { storage, uploadFile } from './firebase.js';
import { ref as dbRef, push as dbPush, set as dbSet, remove as dbRemove, onValue, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

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
      // 모든 li에서 selected 제거
      document.querySelectorAll('#car-list li').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      showCarDetail(car);
    };
    carList.appendChild(li);
  });
}

function renderExpireAlerts() {
  const alertsDiv = document.getElementById('expire-alerts');
  let alerts = [];
  cars.forEach(car => {
    // 보험
    if (car.insurances) {
      Object.values(car.insurances).forEach(ins => {
        if (ins.expire && daysLeft(ins.expire) <= 30) {
          alerts.push(`🚨 <b>${car.name}</b> 차량의 보험(${ins.type})이 ${daysLeft(ins.expire)}일 후 만료됩니다!`);
        }
      });
    }
    // 문서
    if (car.documents) {
      Object.values(car.documents).forEach(doc => {
        if (doc.expire && daysLeft(doc.expire) <= 30) {
          alerts.push(`📄 <b>${car.name}</b> 차량의 레조 문서가 ${daysLeft(doc.expire)}일 후 만료됩니다!`);
        }
      });
    }
  });
  if (alerts.length === 0) {
    alertsDiv.innerHTML = `<div class="expire-alert no-alert">만료 임박 항목 없음</div>`;
  } else {
    alertsDiv.innerHTML = alerts.map(a => `<div class="expire-alert">${a}</div>`).join('');
  }
}
// 차량 목록/보험/문서 데이터가 바뀔 때마다 renderExpireAlerts 호출
// loadCarsFromDB, showApp, 보험/문서 추가/삭제 후 등에서 renderExpireAlerts() 호출
// loadCarsFromDB 내부 마지막에 renderExpireAlerts() 호출
function loadCarsFromDB() {
  const carsRef = dbRef(db, 'companyCars');
  onValue(carsRef, (snapshot) => {
    const val = snapshot.val() || {};
    cars = Object.entries(val).map(([id, car]) => ({ id, ...car }));
    renderCarList();
    renderExpireAlerts();
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
  if (!confirm('정말로 삭제하시겠습니까?')) return;
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
  maint.innerHTML = `<h3>정비 내역 <button class='btn' id='show-monthly-cost'>월별 정비 비용 보기</button></h3>
    <ul>${Object.entries(data).map(([key, m])=>{
      const d = daysLeft(m.date);
      const urgent = d <= 30 ? ` <span style='color:red;font-weight:bold;'>⚠️ ${d}일 남음</span>` : '';
      return `<li>${m.date} <b>[${m.type||'기타'}]</b> - ${m.desc} <span style='color:#1976d2;'>${m.cost ? m.cost+'원' : ''}</span> ${m.shop ? `<span style='color:#888;'>@${m.shop}</span>` : ''} ${m.receipt ? `<a href='${m.receipt}' target='_blank'>영수증</a>` : ''} ${m.etc ? `<span style='color:#888;'>${m.etc}</span>` : ''}${urgent} <button class='btn' onclick='removeMaint("${key}")'>삭제</button></li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-maint-btn'>정비 추가</button>
    <div style='font-size:0.95em;color:#888;margin-top:0.5em;'>만기 30일 이내 항목은 <span style='color:red;'>강조</span>됩니다.<br>이메일 알림은 추후 설정에서 활성화할 수 있습니다.</div>`;
  document.getElementById('add-maint-btn').onclick = () => {
    document.getElementById('maint-modal').style.display = 'flex';
    const saveBtn = document.getElementById('maint-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = async () => {
      const date = document.getElementById('maint-date').value;
      const type = document.getElementById('maint-type').value;
      const cost = document.getElementById('maint-cost').value;
      const desc = document.getElementById('maint-desc').value;
      const shop = document.getElementById('maint-shop').value;
      const receiptInput = document.getElementById('maint-receipt');
      const etc = document.getElementById('maint-etc').value;
      let receiptUrl = '';
      if (receiptInput.files[0]) {
        const path = `users/${currentUser.uid}/cars/${currentCar.id}/maintenances/${Date.now()}_receipt_${receiptInput.files[0].name}`;
        receiptUrl = await uploadFile(path, receiptInput.files[0]);
      }
      if (!date || !desc) {
        alert('날짜와 내용을 입력하세요!');
        return;
      }
      newSaveBtn.disabled = true;
      await addCarData(currentUser.uid, currentCar.id, 'maintenances', { date, type, cost, desc, shop, receipt: receiptUrl, etc });
      document.getElementById('maint-modal').style.display = 'none';
      document.getElementById('maint-date').value = '';
      document.getElementById('maint-type').value = '정기점검';
      document.getElementById('maint-cost').value = '';
      document.getElementById('maint-desc').value = '';
      document.getElementById('maint-shop').value = '';
      document.getElementById('maint-receipt').value = '';
      document.getElementById('maint-etc').value = '';
      newSaveBtn.disabled = false;
    };
    document.getElementById('maint-cancel').onclick = () => {
      document.getElementById('maint-modal').style.display = 'none';
    };
  };
  // 월별 정비 비용 보기 기능
  document.getElementById('show-monthly-cost').onclick = () => {
    const monthly = {};
    Object.values(data).forEach(m => {
      if (!m.date || !m.cost) return;
      const ym = m.date.slice(0,7); // YYYY-MM
      const cost = parseInt(m.cost, 10) || 0;
      if (!monthly[ym]) monthly[ym] = 0;
      monthly[ym] += cost;
    });
    let html = '<h3>월별 정비 비용 합계</h3><table style="width:100%;margin-top:1em;"><tr><th>월</th><th>합계</th></tr>';
    Object.entries(monthly).sort().forEach(([ym, sum]) => {
      html += `<tr><td>${ym}</td><td style='text-align:right;'>${sum.toLocaleString()}원</td></tr>`;
    });
    html += '</table>';
    showSimpleModal(html);
  };
}
window.removeMaint = async function(key) {
  if (!confirm('정말로 삭제하시겠습니까?')) return;
  await removeCarData(currentUser.uid, currentCar.id, 'maintenances', key);
};

// 보험 탭
function renderInsuranceTab(data) {
  const insurance = document.getElementById('insurance');
  insurance.innerHTML = `<h3>보험/등록</h3>
    <ul>${Object.entries(data).map(([key, i])=>{
      const d = daysLeft(i.expire);
      const urgent = d <= 30 ? ` <span style='color:red;font-weight:bold;'>⚠️ ${d}일 남음</span>` : '';
      return `<li><b>[${i.type||'종합보험'}]</b> ${i.expire}${i.company ? ` <span style='color:#1976d2;'>${i.company}</span>` : ''}${i.number ? ` <span style='color:#888;'>#${i.number}</span>` : ''}${urgent} <button class='btn' onclick='removeInsurance("${key}")'>삭제</button></li>`;
    }).join('')}</ul>
    <button class='btn blue' id='add-insurance-btn'>보험 추가</button>
    <div style='font-size:0.95em;color:#888;margin-top:0.5em;'>만기 30일 이내 항목은 <span style='color:red;'>강조</span>됩니다.<br>이메일 알림은 추후 설정에서 활성화할 수 있습니다.</div>`;
  document.getElementById('add-insurance-btn').onclick = () => {
    document.getElementById('insurance-modal').style.display = 'flex';
    const saveBtn = document.getElementById('insurance-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = async () => {
      const type = document.getElementById('insurance-type').value;
      const expire = document.getElementById('insurance-expire').value;
      const company = document.getElementById('insurance-company').value;
      const number = document.getElementById('insurance-number').value;
      if (!type || !expire) {
        alert('보험 종류와 만기일을 입력하세요!');
        return;
      }
      newSaveBtn.disabled = true;
      await addCarData(currentUser.uid, currentCar.id, 'insurances', { type, expire, company, number });
      document.getElementById('insurance-modal').style.display = 'none';
      document.getElementById('insurance-type').value = '종합보험';
      document.getElementById('insurance-expire').value = '';
      document.getElementById('insurance-company').value = '';
      document.getElementById('insurance-number').value = '';
      newSaveBtn.disabled = false;
    };
    document.getElementById('insurance-cancel').onclick = () => {
      document.getElementById('insurance-modal').style.display = 'none';
    };
  };
}
window.removeInsurance = async function(key) {
  if (!confirm('정말로 삭제하시겠습니까?')) return;
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
    // 지도 미리보기, 사진 미리보기 등 기존 바인딩 유지
    document.getElementById('acc-address').oninput = function() {
      const addr = this.value;
      const mapDiv = document.getElementById('acc-map-preview');
      if (addr) {
        mapDiv.innerHTML = `<img src='https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(addr)}&zoom=16&size=200x100&markers=color:red|${encodeURIComponent(addr)}&key=AIzaSyB396sXp7Qo8oIkwm6ASc-qgL_2IhpDBR8'/>`;
      } else {
        mapDiv.innerHTML = '';
      }
    };
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
      preview.querySelectorAll('img.preview').forEach(img=>img.remove());
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.className = 'preview';
        img.src = url;
        preview.appendChild(img);
      });
    };
    // 저장 버튼 안전하게 바인딩
    const saveBtn = document.getElementById('accident-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = async () => {
      const myName = document.getElementById('acc-my-name').value;
      const myPhone = document.getElementById('acc-my-phone').value;
      const otherName = document.getElementById('acc-other-name').value;
      const otherPhone = document.getElementById('acc-other-phone').value;
      const otherAddr = document.getElementById('acc-other-addr').value;
      const desc = document.getElementById('acc-desc').value;
      const address = document.getElementById('acc-address').value;
      const etc = document.getElementById('acc-etc').value;
      const date = new Date().toISOString().slice(0,10);
      if (!myName || !myPhone || !otherName || !otherPhone || !desc || !address) {
        alert('필수 항목을 모두 입력하세요!');
        return;
      }
      newSaveBtn.disabled = true;
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
        myName, myPhone, otherName, otherPhone, otherAddr, otherLicense: otherLicenseUrl, carPhotos: carPhotosUrls, desc, address, etc, date
      });
      document.getElementById('accident-modal').style.display = 'none';
      [
        'acc-my-name','acc-my-phone','acc-other-name','acc-other-phone','acc-other-addr','acc-desc','acc-address','acc-etc'
      ].forEach(id=>document.getElementById(id).value='');
      document.getElementById('acc-other-license').value = '';
      document.getElementById('acc-car-photos').value = '';
      document.getElementById('acc-map-preview').innerHTML = '';
      document.querySelectorAll('#acc-other-license + img, #acc-car-photos + img').forEach(img=>img.remove());
      newSaveBtn.disabled = false;
    };
    document.getElementById('accident-cancel').onclick = () => {
      document.getElementById('accident-modal').style.display = 'none';
    };
  };
}
window.removeAccident = async function(key) {
  if (!confirm('정말로 삭제하시겠습니까?')) return;
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
    const saveBtn = document.getElementById('doc-save');
    // 기존 이벤트 제거
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.onclick = async () => {
      const fileInput = document.getElementById('doc-file');
      const expire = document.getElementById('doc-expire').value;
      if (!expire) {
        alert('레조 만기날짜를 입력하세요!');
        return;
      }
      newSaveBtn.disabled = true;
      let fileUrl = '';
      try {
        if (fileInput.files[0]) {
          const path = `users/${currentUser.uid}/cars/${currentCar.id}/documents/${Date.now()}_${fileInput.files[0].name}`;
          fileUrl = await uploadFile(path, fileInput.files[0]);
        }
        const uploader = currentUser.displayName || currentUser.email || 'Unknown';
        await addCarData(currentUser.uid, currentCar.id, 'documents', { file: fileUrl, expire, uploader });
        document.getElementById('doc-modal').style.display = 'none';
        fileInput.value = '';
        document.getElementById('doc-expire').value = '';
      } catch (e) {
        alert('저장 실패: ' + e.message);
      }
      newSaveBtn.disabled = false;
    };

    document.getElementById('doc-cancel').onclick = () => {
      document.getElementById('doc-modal').style.display = 'none';
    };
  };
}
window.removeDoc = async function(key) {
  if (!confirm('정말로 삭제하시겠습니까?')) return;
  await removeCarData(currentUser.uid, currentCar.id, 'documents', key);
};

// 로그인/로그아웃 UI 처리
// 로그인 후 차량 목록 불러오기
function showApp(user) {
  loginSection.style.display = 'none';
  appSection.style.display = 'block';
  userInfo.innerHTML = `<span class="emoji">👤</span> ${user.displayName || user.email} <button class="btn" id="logout-btn">로그아웃</button>`;
  if (ADMIN_EMAILS.includes(user.email)) {
    userInfo.innerHTML += ` <button class="btn blue" onclick="showApproveModal()">회원 승인</button>`;
    userInfo.innerHTML += ` <button class="btn blue" id="show-admin-stats">정비 통계</button>`;
    setTimeout(() => {
      const statsBtn = document.getElementById('show-admin-stats');
      if (statsBtn) statsBtn.onclick = showAdminStats;
    }, 0);
  }
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

// 회원가입 모달 표시
emailSignupBtn.addEventListener('click', () => {
  document.getElementById('signup-modal').style.display = 'flex';
});
document.getElementById('signup-cancel').onclick = () => {
  document.getElementById('signup-modal').style.display = 'none';
};
document.getElementById('signup-save').onclick = async () => {
  const email = document.getElementById('signup-email').value.trim();
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const password = document.getElementById('signup-password').value;
  if (!email || !name || !phone || !password) {
    alert('모든 항목을 입력하세요!');
    return;
  }
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    // 이름/전화번호 DB에 저장
    const user = userCred.user;
    const userInfoRef = dbRef(db, `users/${user.uid}/profile`);
    await dbSet(userInfoRef, { name, phone, email, approved: false });
    alert('회원가입 성공! 이제 로그인하세요.');
    document.getElementById('signup-modal').style.display = 'none';
    // 입력값 초기화
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-phone').value = '';
    document.getElementById('signup-password').value = '';
  } catch (e) {
    alert('회원가입 실패: ' + e.message);
  }
};

// 로그인 상태 감지 시 currentUser 저장
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    // 승인 여부 확인
    const userInfoRef = dbRef(db, `users/${user.uid}/profile`);
    const snap = await get(userInfoRef);
    if (snap.exists() && snap.val().approved === false) {
      alert('관리자 승인 대기 중입니다. 승인 후 이용 가능합니다.');
      await signOut(auth);
      return;
    }
    logUserLogin(user);
    showApp(user);
  } else {
    currentUser = null;
    showLogin();
  }
});

// 관리자 승인 UI
if (typeof window !== 'undefined') {
  window.showApproveModal = function() {
    document.getElementById('approve-modal').style.display = 'flex';
    const approveList = document.getElementById('approve-list');
    approveList.innerHTML = '<li>로딩중...</li>';
    // 전체 회원 목록 불러오기
    const usersRef = dbRef(db, 'users');
    get(usersRef).then(snap => {
      const users = snap.val() || {};
      approveList.innerHTML = Object.entries(users).map(([uid, u]) => {
        const p = u.profile || {};
        if (!p.name || !p.email) return '';
        let btns = '';
        if (p.approved) {
          btns = `<button class='btn' style='background:#f44336;color:#fff;' onclick='deleteUser("${uid}")'>삭제</button>`;
        } else {
          btns = `<button class='btn blue' onclick='approveUser("${uid}")'>승인</button> <button class='btn' style='background:#f44336;color:#fff;' onclick='deleteUser("${uid}")'>삭제</button>`;
        }
        return `<li style='margin-bottom:0.7em;'><b>${p.name}</b> (${p.email})<br>전화: ${p.phone||''}<br>${btns}</li>`;
      }).join('') || '<li>회원 없음</li>';
    });
  };
  window.approveUser = async function(uid) {
    const userInfoRef = dbRef(db, `users/${uid}/profile`);
    const snap = await get(userInfoRef);
    if (snap.exists()) {
      const profile = snap.val();
      await dbSet(userInfoRef, { ...profile, approved: true });
      alert('승인 완료!');
      showApproveModal();
    }
  };
  window.deleteUser = async function(uid) {
    if (!confirm('정말로 해당 회원을 삭제하시겠습니까?\n(회원의 모든 데이터가 삭제됩니다)')) return;
    const userRef = dbRef(db, `users/${uid}`);
    await dbRemove(userRef);
    alert('삭제 완료!');
    showApproveModal();
  };
  document.getElementById('approve-close').onclick = () => {
    document.getElementById('approve-modal').style.display = 'none';
  };
}

// 관리자 통계 모달 함수
async function showAdminStats() {
  // 모든 차량/정비 데이터 불러오기
  const carsRef = dbRef(db, 'companyCars');
  const carsSnap = await get(carsRef);
  const carsData = carsSnap.val() || {};
  // 차량별 월별 비용 집계 및 상세 내역 저장
  let stats = {}; // { carName: { 'YYYY-MM': sum, ... }, ... }
  let details = {}; // { carName: { 'YYYY-MM': [정비리스트] } }
  for (const [carId, car] of Object.entries(carsData)) {
    const maintRef = dbRef(db, `users/${currentUser.uid}/cars/${carId}/maintenances`);
    const maintSnap = await get(maintRef);
    const maints = maintSnap.val() || {};
    for (const m of Object.values(maints)) {
      if (!m.date || !m.cost) continue;
      const ym = m.date.slice(0,7);
      const cost = parseInt(m.cost, 10) || 0;
      if (!stats[car.name]) stats[car.name] = {};
      if (!stats[car.name][ym]) stats[car.name][ym] = 0;
      stats[car.name][ym] += cost;
      if (!details[car.name]) details[car.name] = {};
      if (!details[car.name][ym]) details[car.name][ym] = [];
      details[car.name][ym].push(m);
    }
  }
  // 월 목록 추출
  const allMonths = new Set();
  Object.values(stats).forEach(carStats => Object.keys(carStats).forEach(m => allMonths.add(m)));
  const months = Array.from(allMonths).sort();
  const carNames = Object.keys(stats);
  // 필터 UI
  let html = `<h3>차량별 월별 정비 비용 통계 <button class='btn blue' id='download-excel'>엑셀 다운로드</button></h3>`;
  html += `<div style='margin-bottom:1em;'>
    <label>차량 <select id='filter-car'><option value=''>전체</option>${carNames.map(c=>`<option value='${c}'>${c}</option>`)}</select></label>
    <label style='margin-left:1em;'>월 <select id='filter-month'><option value=''>전체</option>${months.map(m=>`<option value='${m}'>${m}</option>`)}</select></label>
    <button class='btn' id='show-stats-chart' style='margin-left:1em;'>그래프 보기</button>
  </div>`;
  html += `<table style="width:100%;margin-top:1em;"><tr><th>차량명</th>`;
  months.forEach(m => html += `<th>${m}</th>`);
  html += '</tr>';
  Object.entries(stats).forEach(([car, carStats]) => {
    html += `<tr data-car='${car}'>`;
    html += `<td>${car}</td>`;
    months.forEach(m => {
      if (carStats[m]) {
        html += `<td data-month='${m}' style='text-align:right;cursor:pointer;color:#1976d2;font-weight:bold;' onclick="window.showMaintDetail('${car}','${m}')">${carStats[m].toLocaleString()}원</td>`;
      } else {
        html += `<td data-month='${m}'>-</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</table>';
  showSimpleModal(html);
  // 필터 기능
  setTimeout(() => {
    const carSel = document.getElementById('filter-car');
    const monthSel = document.getElementById('filter-month');
    const table = document.querySelector('#simple-modal table');
    function applyFilter() {
      const carVal = carSel.value;
      const monthVal = monthSel.value;
      table.querySelectorAll('tr[data-car]').forEach(tr => {
        const showCar = !carVal || tr.getAttribute('data-car') === carVal;
        tr.style.display = showCar ? '' : 'none';
        if (showCar && monthVal) {
          tr.querySelectorAll('td[data-month]').forEach(td => {
            td.style.display = td.getAttribute('data-month') === monthVal ? '' : 'none';
          });
        } else if (showCar) {
          tr.querySelectorAll('td[data-month]').forEach(td => { td.style.display = ''; });
        }
      });
      // 헤더도 월 필터 적용
      table.querySelectorAll('th').forEach((th, idx) => {
        if (idx === 0) return;
        const m = months[idx-1];
        th.style.display = (!monthVal || m === monthVal) ? '' : 'none';
      });
    }
    carSel.onchange = applyFilter;
    monthSel.onchange = applyFilter;
  }, 0);
  // 엑셀 다운로드 기능
  setTimeout(() => {
    const btn = document.getElementById('download-excel');
    if (btn) btn.onclick = () => downloadStatsExcel(stats, months, document.getElementById('filter-car').value, document.getElementById('filter-month').value);
  }, 0);
  // 상세 내역 함수 window에 노출
  window.showMaintDetail = (car, ym) => {
    const list = (details[car] && details[car][ym]) ? details[car][ym] : [];
    let html = `<h3>${car} - ${ym} 정비 내역</h3><ul style='max-height:300px;overflow-y:auto;'>`;
    if (list.length === 0) html += '<li>내역 없음</li>';
    else list.forEach(m => {
      html += `<li>${m.date} [${m.type||'기타'}] - ${m.desc} <span style='color:#1976d2;'>${m.cost ? m.cost+'원' : ''}</span> ${m.shop ? `<span style='color:#888;'>@${m.shop}</span>` : ''} ${m.etc ? `<span style='color:#888;'>${m.etc}</span>` : ''}</li>`;
    });
    html += '</ul>';
    showSimpleModal(html);
  };
  // 그래프 보기 기능
  setTimeout(() => {
    const chartBtn = document.getElementById('show-stats-chart');
    if (chartBtn) chartBtn.onclick = () => showStatsChart(stats, months, document.getElementById('filter-car').value, document.getElementById('filter-month').value);
  }, 0);
}
// 엑셀 다운로드 함수 (필터 적용)
function downloadStatsExcel(stats, months, filterCar, filterMonth) {
  if (!window.XLSX) {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
    script.onload = () => downloadStatsExcel(stats, months, filterCar, filterMonth);
    document.body.appendChild(script);
    return;
  }
  const data = [];
  const header = ['차량명'];
  months.forEach(m => {
    if (!filterMonth || m === filterMonth) header.push(m);
  });
  data.push(header);
  Object.entries(stats).forEach(([car, carStats]) => {
    if (filterCar && car !== filterCar) return;
    const row = [car];
    months.forEach(m => {
      if (!filterMonth || m === filterMonth) row.push(carStats[m] ? carStats[m] : '');
    });
    data.push(row);
  });
  const ws = window.XLSX.utils.aoa_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, '정비통계');
  window.XLSX.writeFile(wb, '정비통계.xlsx');
}

// 심플 모달 함수 추가
function showSimpleModal(html) {
  let modal = document.getElementById('simple-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'simple-modal';
    modal.className = 'modal';
    modal.innerHTML = `<div class='modal-content' style='max-width:350px;'><div id='simple-modal-content'></div><div style='margin-top:1em;text-align:center;'><button class='btn' id='simple-modal-close'>닫기</button></div></div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('simple-modal-content').innerHTML = html;
  modal.style.display = 'flex';
  document.getElementById('simple-modal-close').onclick = () => {
    modal.style.display = 'none';
  };
}

// Chart.js 그래프 함수
function showStatsChart(stats, months, filterCar, filterMonth) {
  // Chart.js CDN 동적 로드
  if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => showStatsChart(stats, months, filterCar, filterMonth);
    document.body.appendChild(script);
    return;
  }
  // 데이터 준비
  let labels = [];
  let datasets = [];
  if (filterCar) {
    // 특정 차량의 월별 비용
    labels = months.filter(m => !filterMonth || m === filterMonth);
    const data = labels.map(m => stats[filterCar][m] || 0);
    datasets = [{ label: filterCar, data, backgroundColor: '#1976d2' }];
  } else {
    // 전체 차량의 월별 비용(스택/그룹)
    labels = months.filter(m => !filterMonth || m === filterMonth);
    datasets = Object.keys(stats).map((car, idx) => ({
      label: car,
      data: labels.map(m => stats[car][m] || 0),
      backgroundColor: `hsl(${(idx*60)%360},70%,60%)`
    }));
  }
  // 모달에 캔버스 추가
  let html = `<h3>정비 비용 그래프</h3><canvas id='stats-chart' width='350' height='220'></canvas>`;
  showSimpleModal(html);
  setTimeout(() => {
    const ctx = document.getElementById('stats-chart').getContext('2d');
    new window.Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        plugins: { legend: { display: true } },
        responsive: false,
        scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString()+'원' } } }
      }
    });
  }, 100);
}