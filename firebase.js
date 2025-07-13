// Firebase 초기화 및 인증 (Google/Email)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, push, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-BYaIUXgk8szUEuwdmqf8xXdzr8Ss2cs",
  authDomain: "jkcar-management.firebaseapp.com",
  databaseURL: "https://jkcar-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jkcar-management",
  storageBucket: "jkcar-management.firebasestorage.app",
  messagingSenderId: "158717054066",
  appId: "1:158717054066:web:c42faad070cde9911d06eb",
  measurementId: "G-3WRFDYEP1T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getDatabase(app);

// 차량별 데이터 경로 생성
function carDataRef(uid, carId, type) {
  return ref(db, `users/${uid}/cars/${carId}/${type}`);
}

// 데이터 추가
async function addCarData(uid, carId, type, data) {
  const newRef = push(carDataRef(uid, carId, type));
  await set(newRef, data);
  return newRef.key;
}
// 데이터 삭제
async function removeCarData(uid, carId, type, key) {
  await remove(ref(db, `users/${uid}/cars/${carId}/${type}/${key}`));
}
// 데이터 전체 불러오기
async function getCarData(uid, carId, type, callback) {
  onValue(carDataRef(uid, carId, type), (snapshot) => {
    const val = snapshot.val() || {};
    callback(val);
  });
}

const storage = getStorage(app);

async function uploadFile(path, file) {
  const fileRef = sRef(storage, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

export { auth, provider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, db, addCarData, removeCarData, getCarData, storage, uploadFile, getDownloadURL }; 