const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const { prefix } = require('./config.json');
var auth = require('./auth.json');
const bot = new Discord.Client();




const options = {
    gl: 'TW',
    hl: 'TW',
    limit: 1,
    safeSearch: true,
}




// 連上線時的事件
bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.tag}!`);
    bot.user.setPresence({ activity: { name: `?help` }, status: 'online' });
});
bot.login(auth.token);




// 建立一個類別來管理 Property 及 Method
class Music {

    constructor() {
        this.isPlaying = false;
        this.queue = {};
        this.connection = {};
        this.dispatcher = {};
        this.joinChannel = false;
        this.sameChannel = {};
    }


    async search(msg) {
        //youtube搜尋
        var firstResultBatch = await ytsr(msg, options);
        var data = JSON.stringify(firstResultBatch.items[0]);
        data = JSON.parse(data)
        console.log(data.url)
        return String(data.url)
    }


    async join(msg) {
        // Bot 加入語音頻道
        this.connection[msg.guild.id] = await msg.member.voice.channel.join();
        this.joinChannel = true;
    }

    async play(msg) {

        const guildID = msg.guild.id;// 語音群的 ID
        let musicURL;

        // 如果 Bot 還沒加入該語音群的語音頻道 則自動加入
        if (this.joinChannel == false) {
            this.joinChannel = true;
            music.join(msg).then(() => { music.play(msg); })
            return;
        }


        //檢測如果是中文字就進yt搜尋
        if (msg.content.indexOf(`http`) > -1 != true) {
            musicURL = String(await this.search(msg.content.replace(`${prefix}p`, '').trim()))
        }
        else {
            // 處理字串，將'+p'字串拿掉，只留下 YouTube url
            musicURL = msg.content.replace(`${prefix}p`, '').trim();
        }



        try {
            // 取得 YouTube 影片資訊
            const res = await ytdl.getInfo(musicURL);
            const info = res.videoDetails;

            // 將歌曲資訊加入隊列
            if (!this.queue[guildID]) {
                this.queue[guildID] = [];
            }

            this.queue[guildID].push({
                name: info.title,
                url: musicURL
            });
            msg.react('👍')

            // 如果目前正在播放歌曲就加入列隊，反之則播放歌曲
            if (this.isPlaying) {
                msg.channel.send(Play_Embed('Queued', info.title, musicURL))
                //msg.channel.send(`歌曲加入列隊：${info.title}`);
            } else {
                this.isPlaying = true;
                this.playMusic(msg, guildID, this.queue[guildID][0]);
            }

        } catch (e) {
            console.log(e);
        }
    }

    playMusic(msg, guildID, musicInfo) {

        // 提示播放音樂
        msg.channel.send(Play_Embed('Now Playing', musicInfo.name, musicInfo.url))
        //msg.channel.send(`播放音樂：${musicInfo.name}`);

        // 播放音樂
        this.dispatcher[guildID] = this.connection[guildID].play(ytdl(musicInfo.url, { filter: 'audioonly' }));

        // 把音量降 50%
        //this.dispatcher[guildID].setVolume(0.5);

        // 移除 queue 中目前播放的歌曲
        this.queue[guildID].shift();

        // 歌曲播放結束時的事件
        this.dispatcher[guildID].on('finish', () => {

            // 如果隊列中有歌曲
            if (this.queue[guildID].length > 0) {
                this.playMusic(msg, guildID, this.queue[guildID].shift());
            } else {
                this.isPlaying = false;
                //msg.channel.send('目前沒有音樂');
            }
        });
    }

    resume(msg) {
        if (this.dispatcher[msg.guild.id]) {
            msg.react('▶️')
            //msg.channel.send('恢復播放');

            // 恢復播放
            this.dispatcher[msg.guild.id].resume();
        }
    }

    pause(msg) {
        if (this.dispatcher[msg.guild.id]) {
            msg.react('⏸️')
            //msg.channel.send('暫停播放');

            // 暫停播放
            this.dispatcher[msg.guild.id].pause();
        }
    }

    skip(msg) {
        if (this.dispatcher[msg.guild.id]) {
            msg.react('👍')
            //msg.channel.send('跳過目前歌曲');

            // 跳過歌曲
            this.dispatcher[msg.guild.id].end();
        }
    }

    nowQueue(msg) {
        // 如果隊列中有歌曲就顯示
        if (this.queue[msg.guild.id] && this.queue[msg.guild.id].length > 0) {
            // 字串處理，將 Object 組成字串
            var queueString = this.queue[msg.guild.id].map((item, index) => `[${index + 1}] ${item.name}`).join();
            queueString = queueString.split(',');
            msg.channel.send(Queue_Embed('Queue', queueString))
            //msg.channel.send(queueString);
        } else {
            msg.react('❌')
            //msg.channel.send('列隊中沒有歌曲');
        }
    }

    leave(msg) {
        // 離開頻道
        msg.react('👍')
        this.isPlaying = false;
        this.joinChannel = false;
        this.queue[msg.guild.id] = [];
        this.connection[msg.guild.id].disconnect();
    }
}
const music = new Music();




bot.on('message', async (msg) => {

    var args = msg.content.toLowerCase()
    var user = msg.author.username + ' :';
    var same = msg.member.voice.channelID;


    // 如果發送訊息的地方不是語音群（可能是私人）就 return
    if (!msg.guild) return;

    // bot加入語音頻道  // +join
    if (args === `${prefix}join`) {
        music.join(msg);
        console.log(user, args);
    }

    // 播放音樂  // +p  // 如果使用者輸入的內容中包含 +p 
    if (msg.content.indexOf(`${prefix}p`) > -1) {
        if (msg.member.voice.channel) {//使用者是否在語音頻道
            if (same !== music.sameChannel) {//使用者是否在同一個語音頻道
                music.sameChannel = same;
                music.join(msg);
            }

            await music.play(msg);
            console.log(user, args);
        }
    }

    // 恢復音樂  // +resume
    if (args === `${prefix}resume`) {
        music.resume(msg);
        console.log(user, args);
    }

    // 暫停音樂  // +pause
    if (args === `${prefix}pause`) {
        music.pause(msg);
        console.log(user, args);
    }

    // 跳過音樂  // +skip
    if (args === `${prefix}skip`) {
        music.skip(msg);
        console.log(user, args);
    }

    // 查看隊列  // +queue
    if (args === `${prefix}queue`) {
        music.nowQueue(msg);
        console.log(user, args);
    }

    // 機器人離開頻道  // +leave
    if (args === `${prefix}leave`) {
        music.leave(msg);
        console.log(user, args);
    }

    if (args === `?help`) {
        msg.channel.send(Help_Embed());
        console.log(user, args);
    }
});



function Play_Embed(status, TitleName, Url) {
    const Play_Embed = new Discord.MessageEmbed()
        .setColor('#FFFFFF')
        .addField(status, `[${TitleName}](${Url})`, true)
        .setTimestamp()
    return Play_Embed
}

function Queue_Embed(status, TitleName) {
    const Queue_Embed = new Discord.MessageEmbed()
        .setColor('#FFFFFF')
        .addField(status, TitleName, true)
        .setTimestamp()
    return Queue_Embed
}

function Help_Embed() {
    const Help_Embed = new Discord.MessageEmbed()
        .setColor('#FFFFFF')
        .addField('Help', '```+join      => 加入頻道\n+p空格網址  => 播放音樂\n+pause     => 暫停音樂\n+resume    => 恢復播放\n+skip      => 跳過音樂\n+queue     => 查看列隊\n+leave     => 離開頻道```', true)
        .setTimestamp()
    return Help_Embed
}
