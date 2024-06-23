import React, {useState, useEffect} from "react";
import Sidebar from "../../components/Sidebar";
import axios from "axios";
import {Bars} from "react-loader-spinner";
import {db} from "../../firebase/firestore";
import {doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, where} from "firebase/firestore";
import PaymentReportBox from "./PaymentsReportBox"
import { useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons'

const Popup = React.lazy(() => import("../../components/Popup"));

function Payments() {
    const [searchParams, setSearchParams] = useSearchParams();
    const merchantTransactionId = searchParams.get("merchantTransactionId");
    const merchantId = searchParams.get("merchantId");
    const amount = searchParams.get("amount");
    const docId = searchParams.get("docId");
    const [paymentsData, setPaymentsData] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [showWhat, setShowWhat] = useState(searchParams.get("showWhat") === "currentPayments" || searchParams.get("showWhat") === "paymentsHistory" ? searchParams.get("showWhat") : "currentPayments");
    const [loading, setLoading] = useState(false);
    const [cloaseAllowed, setCloseAllowed] = useState(false);
    const [popupLoading, setPopupLoading] = useState(true);
    const [openPopup, setOpenPopup] = useState(false);
    const [showPopup, setShowPopup] = useState((merchantTransactionId !== "" && merchantTransactionId !== undefined && merchantTransactionId !== null) && (merchantId !== "" && merchantId !== undefined && merchantId !== null) ? true : false);
    const [status, setStatus] = useState("pending");

    let encodedAuth = localStorage.getItem("auth");
    let uid;
    let email;

    if (encodedAuth != null) {
        let decodedAuth = atob(encodedAuth);

        let split = decodedAuth.split("-");

        uid = split[0];
        email = split[1];
    }

    useEffect(() => {
        const studentDataQuery = query(collection(db, "studentData"), where("email", "==", email));
        onSnapshot(studentDataQuery, (studentQuerySnapshot) => {
            studentQuerySnapshot.forEach(snap => {
                window.docId = snap.id;
                const q = query(collection(db, "studentData", snap.id, "taData"), where("paymentInfo.status", "==", "pending"));
                onSnapshot(q, (taQuerySnapshot) => {
                    const dataArray = [];
                    taQuerySnapshot.forEach(taSnap => {
                        const temp = taSnap.data();
                        temp.docId = taSnap.id;
                        temp.type = "tinkeringActivity";
                        dataArray.push(temp);
                    });
                    setPaymentsData(dataArray);
                    console.log(dataArray);
                })
            });
        });
        const userDoc = doc(db, "atlUsers", uid);
        (async () => {
            const userDocData = await getDoc(userDoc);
            if (userDocData.data().purchases !== undefined) {
                const purchases = userDocData.data().purchases;
                setPurchaseHistory(purchases.map((item, idx) => purchases[purchases.length - 1 - idx]));
            }
        })();
    }, []);

    useEffect(() => {
        if (showPopup) {
            (async () => {
                try {
                    const response = await axios.post("https://us-central1-hamaralabs-prod.cloudfunctions.net/paymentIntegration/getStatus", {
                        merchantTransactionId: merchantTransactionId,
                        merchantId: merchantId
                    });

                    if (response.data.data.code === "PAYMENT_SUCCESS") {
                        setStatus("success");
                        const userDoc = doc(db, "atlUsers", uid);
                        const docData = await getDoc(userDoc);
                        const userPurchases = docData.data().purchases;
                        const taPurchased = doc(db, "studentData", window.docId, "taData", docId);
                        if (userPurchases !== undefined) {
                            let isPresent = false;
                            for (let i = 0; i < userPurchases.length; i++) {
                                if (userPurchases[i].merchantTransactionId === merchantTransactionId) {
                                    isPresent = true;
                                }
                            }
                            if (isPresent === false) {
                                userPurchases.push({
                                    merchantTransactionId: merchantTransactionId,
                                    amount: amount,
                                    type: "tinkeringActivity",
                                    doc: taPurchased,
                                    status: "success",
                                    timestamp: new Date().toUTCString()
                                });
                                await setDoc(userDoc, {
                                    purchases: userPurchases
                                }, {merge: true});
                            }
                        } else {
                            const userPurchases = [{
                                merchantTransactionId: merchantTransactionId,
                                amount: amount,
                                type: "tinkeringActivity",
                                doc: taPurchased,
                                status: "success",
                                timestamp: new Date().toUTCString()
                            }];

                            await setDoc(userDoc, {
                                purchases: userPurchases
                            }, {merge: true});
                        }

                        await updateDoc(taPurchased, {
                            paymentInfo: {
                                status: "success",
                                amount: amount,
                                merchantTransactionId: merchantTransactionId,
                            }
                        });
                    } else {
                        setStatus("failed");
                        const userDoc = doc(db, "atlUsers", uid);
                        const docData = await getDoc(userDoc);
                        const userPurchases = docData.data().purchases;
                        const taPurchased = doc(db, "studentData", window.docId, "taData", docId);
                        if (userPurchases !== undefined) {
                            let isPresent = false;
                            for (let i = 0; i < userPurchases.length; i++) {
                                if (userPurchases[i].merchantTransactionId === merchantTransactionId) {
                                    isPresent = true;
                                }
                            }
                            if (isPresent === false) {
                                userPurchases.push({
                                    merchantTransactionId: merchantTransactionId,
                                    amount: amount,
                                    type: "tinkeringActivity",
                                    doc: taPurchased,
                                    status: "failed",
                                    timestamp: new Date().toUTCString()
                                });
                                await setDoc(userDoc, {
                                    purchases: userPurchases
                                }, {merge: true});
                            }
                        } else {
                            const userPurchases = [{
                                merchantTransactionId: merchantTransactionId,
                                amount: amount,
                                type: "tinkeringActivity",
                                doc: taPurchased,
                                status: "failed",
                                timestamp: new Date().toUTCString()
                            }];

                            await setDoc(userDoc, {
                                purchases: userPurchases
                            }, {merge: true});
                        }
                    }

                    setOpenPopup(true);
                    setPopupLoading(false);
                    setCloseAllowed(true);
                } catch (error) {
                    console.log(error);
                    setStatus("failed");
                    setPopupLoading(false);
                    setCloseAllowed(true);
                    setOpenPopup(true);
                }
            })();
        }

        if (openPopup && showPopup === false) {
            setOpenPopup(false);
            window.location.href = "/payments?showWhat=paymentsHistory";
        }
    }, [showPopup]);

    document.title = "Payments | Digital ATL";

    if (loading) {
        return (
            <div style={{height: "85%", display: "flex", alignItems: "center", justifyContent: "center"}}>
                {<Bars
                    height="80"
                    width="80"
                    radius="9"
                    color="black"
                    ariaLabel="loading"
                    wrapperStyle
                    wrapperClass
                />}
            </div>
        );
    }

    return (
        <div className="container">
            <link rel="stylesheet" href="/CSS/form.css"/>
            <link rel="stylesheet" href="/CSS/report.css"/>
            <Sidebar />
            <Popup trigger={showPopup} setPopupEnabled={setShowPopup} closeAllowed={cloaseAllowed}>
                <>
                    <span style={{fontWeight: "600", fontSize: "20px"}}>Merchant Transaction ID : {merchantTransactionId}</span>
                    <br/>
                    {!popupLoading ? (status === "success" ? <span style={{fontWeight: "600", fontSize: "20px"}}> Payment Status: Successful</span> : <span style={{fontWeight: "600", fontSize: "20px"}}>Payment Status: Failed</span>): ""}
                    <div style={{height: "85%", display: "flex", alignItems: "center", justifyContent: "center"}}>
                        {popupLoading ? <Bars
                            height="80"
                            width="80"
                            radius="9"
                            color="black"
                            ariaLabel="loading"
                            wrapperStyle
                            wrapperClass
                        />: ""}

                        {!popupLoading ? (status === "success" ? <FontAwesomeIcon icon={faCheckCircle} size="3x" color="green" />: <FontAwesomeIcon icon={faTimesCircle} size="3x" color="red" />) : ""}
                    </div>
                </>
            </Popup>
            <div style={{height: "10vh"}}>
                <h1 className="title">Payments | Digital ATL</h1>
                <hr/>
            </div>
            <label htmlFor="showWhat">Showing</label>
            <select name="showWhat" id="showWhat" value={showWhat} onChange={(e) => {
                setShowWhat(e.target.value)
                setSearchParams({showWhat: e.target.value});
                console.log(e.target.value);
                }}>
                <option value="currentPayments">Current Payments</option>
                <option value="paymentsHistory">Payments History</option>
            </select>
            <hr/>
            {showWhat === "currentPayments" ? (
                CurrentPayments({paymentsData, setLoading})
            ) : (
                PaymentsHistory({purchaseHistory, setLoading})
            )}
        </div>
    );
}

function CurrentPayments ({paymentsData, setLoading}) {
    return (
        <>
            {
                paymentsData.map((data) => (
                    <PaymentReportBox data={data} showWhat="currentPayments" setLoading={setLoading}/>
                ))
            }
        </>
    );
}

function PaymentsHistory ({purchaseHistory, setLoading}) {
    return (
        <>
            {
                purchaseHistory.map((data) => (
                    <PaymentReportBox data={data} showWhat="paymentsHistory" setLoading={setLoading}/>
                ))
            }
        </>
    );
}

export default Payments;