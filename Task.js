class Future {
    constructor(resolver) {
        this.handlers = [];
        this.result = undefined;
        try {
            resolver(value => this.resolve(value), reason => this.reject(reason));
        } catch (reason) {
            this.reject(reason);
        }
    }

    get state() {
        if (!this.result) {
            return "pending";
        }
        else {
            let [fulfilled]=this.result;
            return fulfilled ? "fulfilled" : "rejected";
        }
    }

    resolve(value) {
        if (this.result) {
            return;
        }
        this.result = [true, value, undefined];
        this.handlers.forEach(([onFulfilled]) => onFulfilled && onFulfilled(value));
    }

    reject(reason) {
        if (this.result) {
            return;
        }
        this.result = [false, undefined, reason];
        this.handlers.forEach(([_, onRejected]) => onRejected && onRejected(reason));
    }

    then(onFulfilled, onRejected) {
        let canFulfill=typeof onFulfilled === "function";
        let canReject=typeof onRejected === "function";
        if (this.result) {
            let [fulfilled, value, reason] = this.result;
            if (fulfilled) {
                if(canFulfill){
                    let v;
                    try {
                        v = onFulfilled(value);
                    } catch (reason) {
                        return Future.reject(reason);
                    }
                    return Future.resolve(v);
                }else{
                    return Future.resolve(value);
                }

            } else {

                if(canReject){
                    let r;
                    try {
                        r = onRejected(reason);
                    } catch (reason) {
                        return Future.reject(reason);
                    }
                    return Future.resolve(r);
                }
                else{
                    return Future.reject(reason);
                }
            }
        }
        return new Future((resolve, reject) => {
            let fulfillmentHandler = value => {
                if(canFulfill){
                    let v;
                    try {
                        v = onFulfilled(value);
                    } catch (reason) {
                        Future.reject(reason).then(reject);
                    }
                    Future.resolve(v).then(resolve);
                }else{
                    Future.resolve(value).then(resolve);
                }
            };
            let rejectionHandler = reason => {

                if(canReject) {
                    let r;
                    try {
                        r = onRejected(reason);
                    } catch (reason) {
                        Future.reject(reason).then(reject);
                    }
                    Future.resolve(r).then(reject);
                }else{
                    Future.reject(reason).then(reject);
                }
            };
            this.handlers.push([fulfillmentHandler, rejectionHandler]);
        });
    }

    catch(onRejected) {
        return this.then(undefined,onRejected);
    }

    static resolve(value) {
        if (value && typeof value.then === "function") {
            return new Future((resolve, reject) => value.then(resolve, reject));
        }
        return new Future(resolve => resolve(value));
    }

    static reject(value) {
        if (value && typeof value.then === "function") {
            return new Future((resolve, reject) => value.then(resolve, reject));
        }
        return new Future((resolve, reject) => reject(value));
    }
}
class Task {
    constructor(resolver) {
        let future;
        if (typeof resolver === "function") {
            future = new Future(resolver);
        } else if(resolver&&resolver instanceof Future){
          future = resolver;
        }else{
          throw Error("bad resolver");
        }

        this.then = (onFulfilled, onRejected) => new Task(future.then(onFulfilled, onRejected));
        this.catch = onRejected => new Task(future.catch(onRejected));
        Object.defineProperty(this, "state", {
            get: ()=>future.state,
            enumerable: true
        });
    }

    static resolve(value) {
        return new Task(Future.resolve(value));
    }
  
    static all(tasks){
      return tasks.reduce((prev,curr)=>prev.then(v=>curr.then(vv=>v.concat(vv))),Task.resolve([]));
    }
  
    static race(tasks){
      return new Task((resolve,reject)=>{
        tasks.forEach(t=>t.then(resolve,reject));
      });
    }
}

/*
var delay=time=>new Task((resolve)=>setTimeout(resolve,time));
function *gen(){
  for(var i=0;;i++){
    yield i;
  }
}

Task.race([delay(1000).then(()=>1),delay(1000).then(()=>2)]).then(console.log.bind(console))

var t=new Task(()=>{
    throw Error("An expected error");
  })
  .then(v=>void(console.log(v)))
  .then(v=>console.log(v))
  .catch(v=>{
    console.log("!ok "+v);
    return delay(5000)
      .then(()=>"all is good");
  })
  .then(v=>{
    console.log(v);
    //setTimeout(()=>console.log(t),1000);
  })
  .then(_=>{
    (async ()=>{
      for(var i of gen()){
        document.body.innerHTML=`counter : ${i}`;
        let t = delay(1000);
        await t;
      }
    })();
  });
  */