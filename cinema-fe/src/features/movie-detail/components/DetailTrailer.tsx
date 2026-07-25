const DetailTrailer = () => {
  return (
    <div>
      <div
        className="absolute left-[45%] top-[60%] w-1/2 -translate-x-1/2 -translate-y-1/2"
        id="videoPlayer"
        style={{ display: 'none' }}
      >
        <video width="100%" controls autoPlay id="myVideo" src="https://youtu.be/gq2xKJXYZ80">
          <source src="https://youtu.be/gq2xKJXYZ80" />
        </video>
        <i className="fa-solid fa-circle-xmark absolute right-[10px] top-[5px] w-[30px] cursor-pointer text-[50px] text-[#E00813]" />
      </div>
    </div>
  );
};

export default DetailTrailer;
