import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, TextInput, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, updateDoc, doc, serverTimestamp, increment, decrement, arrayUnion, arrayRemove, getDoc, onSnapshot } from 'firebase/firestore'; // Import Firestore methods
import { firestore } from '../config'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

const PostScreen = () => {
  const [cameraPermission, setCameraPermission] = useState(null);
  const [galleryPermission, setGalleryPermission] = useState(null);
  const [camera, setCamera] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expression, setExpression] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showPosts, setShowPosts] = useState(false); 
  const [commentText, setCommentText] = useState('');
  const [userData, setUserData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [user, setuser] = useState({})
  const [showPostButton, setShowPostButton] = useState(false);
  const [newImageUri, setnewImageUri] = useState(null)
  const [commentTexts, setCommentTexts] = useState({});

  const storageUrl = 'petemotes-25000.appspot.com';

  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setCameraPermission(cameraPermission.status === 'granted');
      setGalleryPermission(galleryPermission.status === 'granted');
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, 'posts'), (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      postsData.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        } else if (a.createdAt) {
          return -1;
        } else if (b.createdAt) {
          return 1;
        } else {
          return 0;
        }
      });
      setPosts(postsData);
    });
    setShowPosts(true);
    return () => unsubscribe();
  }, []);

  const getImageUrlToShow = (image) => {
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${storageUrl}/o/${encodeURIComponent(image)}?alt=media`;
    return imageUrl
  }

  const preFetchDP = (userProfilePic) => {
    const imageRef = getImageUrlToShow(userProfilePic)
    setImageUri(imageRef)
    setnewImageUri(imageRef)
  }

  useEffect(() => {
    const getUser = async () => {
      const userData = await AsyncStorage.getItem('userData');
      if(userData){
        const user = JSON.parse(userData);
        setUserData(user)
        setCurrentUserId(user.userRef)
        preFetchDP(user.userProfilePic)
      }
      else{
        const usersRef = collection(firestore, "users");
        const q = query(usersRef, where("email", "==", auth.currentUser.email));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            const { userName, user_id, email, dp_url,birthday } = userData;
            const loggedUserInfo = {
                userRef: user_id,
                userEmail: email,
                userName: userName,
                userProfilePic: dp_url,
                birthday
            };
            setUserData(loggedUserInfo)
            preFetchDP(dp_url)
          }
        );
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    if(userData) preFetchDP(userData.userProfilePic)
  }, [userData])

  const takePicture = async () => {
    if (camera) {
      const photo = await camera.takePictureAsync({ quality: 0.5 });
      setSelectedImage(photo.uri);
      detectExpression(photo.uri);
      setIsCameraOpen(false); // Close the camera after taking the picture
    setShowPostButton(true); 
    }
  };

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
  
    if (!result.canceled) {
      setSelectedImage(result.uri);
      setImageUri(result.uri);
      detectExpression(result.uri); // Detect expression for the selected image
      setIsCameraOpen(false); // Close the camera if it's open
      setShowPostButton(true); // Show the post button after selecting the image
    }
  };

  const handlePostAfterImageSelection = () => {
    handlePost();
    setShowPostButton(false); // Hide the post button after posting the image
  };
  
  

  const detectExpression = async (imageUri) => {
    const expressions = ['Happy', 'Sad', 'Angry', 'Surprised', 'Neutral'];
    const detectedExpression = expressions[Math.floor(Math.random() * expressions.length)];
    setExpression(detectedExpression);
  };

  const handleLike = async (postId) => {
    try {
      const postRef = doc(firestore, 'posts', postId);
      const postSnapshot = await getDoc(postRef);
      const postData = postSnapshot.data();
      
      if (postData.dislikedBy && postData.dislikedBy.includes(currentUserId)) {
        await updateDoc(postRef, {
          dislikes: decrement(1),
          dislikedBy: arrayRemove(currentUserId)
        });
      }
      
      await updateDoc(postRef, {
        likes: increment(1),
        likedBy: arrayUnion(currentUserId)
      });
      
      console.log('Post liked with ID: ', postId);
    } catch (error) {
      console.error('Error liking post: ', error);
    }
  };

  const handleDislike = async (postId) => {
    try {
      const postRef = doc(firestore, 'posts', postId);
      const postSnapshot = await getDoc(postRef);
      const postData = postSnapshot.data();
      
      if (postData.likedBy && postData.likedBy.includes(currentUserId)) {
        await updateDoc(postRef, {
          likes: postData.likes - 1, // Manually decrease likes by 1
          likedBy: arrayRemove(currentUserId)
        });
      }
      
      await updateDoc(postRef, {
        dislikes: postData.dislikes + 1, // Manually increase dislikes by 1
        dislikedBy: arrayUnion(currentUserId)
      });
      
      console.log('Post disliked with ID: ', postId);
    } catch (error) {
      console.error('Error disliking post: ', error);
    }
  };
  

  const handleAddComment = async (postId) => {
    const currentCommentText = commentTexts[postId];
    if (!currentCommentText || currentCommentText.trim() === '') {
      return;
    }
    try {
      await updateDoc(doc(firestore, 'posts', postId), {
        comments: arrayUnion(currentCommentText)
      });
      console.log('Comment added to post with ID: ', postId);
      setCommentTexts({ ...commentTexts, [postId]: '' });
    } catch (error) {
      console.error('Error adding comment: ', error);
    }
  };
  
  const handlePost = async () => {
    if (isCameraOpen) {
      console.warn('Cannot post while the camera is open.');
      return;
    }
  
    if (!selectedImage && !postText.trim()) {
      console.warn('Image or post text is missing.'); // Log a warning if image or post text is missing
      return;
    }
  
    try {
      const postData = {
        expression,
        likes: 0,
        dislikes: 0,
        comments: [],
        createdAt: serverTimestamp(),
        userId: currentUserId,
        user: {
          name: userData.userName,
          profileImage: userData.userProfilePic
        }
      };
  
      if (selectedImage) {
        postData.imageUrl = selectedImage; // Set imageUrl only if an image is selected
        setImageUri(null);
      }
  
      if (postText.trim()) {
        postData.text = postText.trim(); // Set text only if it's not empty
      }
  
      const newPostRef = await addDoc(collection(firestore, 'posts'), postData);
      console.log('New post added with ID: ', newPostRef.id);
      setSelectedImage(null);
      setExpression(null);
      setPostText('');
      setShowPosts(true);
    } catch (error) {
      console.error('Error adding post: ', error);
    }
  };
  

  // console.log(posts[0]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Detect and Create a post</Text>
      </View>
      <View style={styles.postContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={() => setShowPosts(false)}>
          <Ionicons name="close" size={30} color="black" />

        </TouchableOpacity>
        <View style={styles.inputContainer}>
          <Image source={{ uri: imageUri}} style={styles.profileImage} />
          <TextInput
            placeholder="What's on your mind?"
            multiline={true}
            style={styles.input}
            value={postText}
            onChangeText={setPostText}
          />
        </View>
        {!selectedImage && !isCameraOpen && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setIsCameraOpen(true)}>
              <Ionicons name="camera" size={24} color="black" />
              <Text style={styles.actionText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={pickImageFromGallery}>
              <Ionicons name="image" size={24} color="black" />
              <Text style={styles.actionText}>Gallery</Text>
            </TouchableOpacity>

              {showPostButton && (
  <TouchableOpacity style={styles.postImageButton} onPress={handlePostAfterImageSelection}>
    <Text style={styles.postImageButtonText}>Post</Text>
  </TouchableOpacity>
)}
          </View>
        )}
        {isCameraOpen && cameraPermission && (
          <Camera
            style={styles.camera}
            type={Camera.Constants.Type.back}
            ref={(ref) => setCamera(ref)}
          >
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsCameraOpen(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.takePictureButton} onPress={takePicture}>
              <Ionicons name="camera" size={50} color="white" />
            </TouchableOpacity>
          </Camera>
        )}
        {selectedImage && (
          <View style={styles.imageContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
              <Ionicons name="close" size={30} color="black" />
            </TouchableOpacity>
            <Image source={{ uri: selectedImage }} style={styles.image} />
            <Text style={styles.expressionText}>Detected Expression: {expression}</Text>
            <TouchableOpacity style={styles.postImageButton} onPress={handlePost}>
              <Text style={styles.postImageButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {showPosts && (
        <FlatList
          data={posts}
          renderItem={({ item }) => (
            <View style={styles.post}>
             <View style={styles.userInfo}>
               {item.user && item.user.profileImage && (
                 <Image source={{ uri: `https://firebasestorage.googleapis.com/v0/b/${storageUrl}/o/${encodeURIComponent(item.user.profileImage)}?alt=media` }} style={styles.profileImage} />
                  )}
                      {item.user && item.user.name && (
                         <Text style={styles.userName}>{item.user.name}</Text>
                   )}
                </View>


              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              )}
              {item.text !== '' && (
                <Text style={styles.postText}>{item.text}</Text>
              )}
              <Text style={styles.expressionText}>Detected Expression: {item.expression}</Text>
              <View style={styles.interactionContainer}>
                <TouchableOpacity style={styles.interactionButton} onPress={() => handleLike(item.id)}>
                  <Ionicons name="thumbs-up" size={20} color="blue" />
                  <Text style={styles.interactionButtonText}>Like ({item.likes})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.interactionButton} onPress={() => handleDislike(item.id)}>
                  <Ionicons name="thumbs-down" size={20} color="red" />
                  <Text style={styles.interactionButtonText}>Dislike ({item.dislikes})</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.commentsContainer}>
              <TextInput
  placeholder="Write a comment..."
  value={commentTexts[item.id] || ''}
  onChangeText={(text) => setCommentTexts({ ...commentTexts, [item.id]: text })}
  style={styles.inputComment}
/>

                <TouchableOpacity
                  style={styles.commentButton}
                  onPress={() => handleAddComment(item.id)}
                >
                  <Text style={styles.commentButtonText}>Comment</Text>
                </TouchableOpacity>
                <Text style={styles.commentsTitle}>Comments:</Text>
                {item.comments.map((comment, index) => (
                  <Text key={index} style={styles.comment}>{comment}</Text>
                ))}
              </View>
            </View>
          )}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  postContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 20,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingBottom: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  camera: {
    height: 200,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  takePictureButton: {
    marginBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  imageContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    marginBottom: 10,
    borderRadius: 10,
  },
  expressionText: {
    marginBottom: 10,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
  },
  actionText: {
    marginLeft: 5,
  },
  post: {
    marginBottom: 20,
  },
  interactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  interactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  interactionButtonText: {
    marginLeft: 5,
  },
  commentsContainer: {
    marginTop: 10,
  },
  commentsTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  comment: {
    marginLeft: 10,
    marginBottom: 5,
  },
  inputComment: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  commentButton: {
    backgroundColor: '#4267B2',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 10,
  },
  commentButtonText: {
    color: '#fff',
  },
  postImageButton: {
    backgroundColor: '#4267B2',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 10,
  },
  postImageButtonText: {
    color: '#fff',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userProfileImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PostScreen;