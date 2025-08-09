const firebaseConfig = {
    apiKey: "AIzaSyAE-1WMAGCEWD7D1hm_QS6fxQKFEkYU168",
    authDomain: "rwandabet-8296f.firebaseapp.com",
    projectId: "rwandabet-8296f",
    storageBucket: "rwandabet-8296f.firebasestorage.app",
    messagingSenderId: "1059346620817",
    appId: "1:1059346620817:web:d55765a42a2d910b13fa30",
    measurementId: "G-3VLM591HJH"
  };
  
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  
  function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
  
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const email = userCredential.user.email;
        // Initialize balance to 0
        firebase.firestore().collection("users").doc(email).set({
          balance: 0
        });
        window.location.href = "dashboard.html";
      })
      .catch(error => {
        document.getElementById("message").innerText = error.message;
      });
  }
  
  function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
  
    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        window.location.href = "dashboard.html";
      })
      .catch(error => {
        document.getElementById("message").innerText = error.message;
      });
  }
  
  function logout() {
    auth.signOut().then(() => {
      window.location.href = "index.html";
    });
  }
  